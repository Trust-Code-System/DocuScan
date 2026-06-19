/**
 * AI document features — provider-agnostic (Anthropic Claude OR OpenAI).
 *
 * Env-gated like the rest of lib/*: with no key set the whole module is inert
 * and `aiEnabled()` is false (callers return 503). Both SDKs are lazily imported
 * so builds/deploys without AI never pull them into the hot path.
 *
 * Provider selection (see .env.example):
 *   - AI_PROVIDER=openai|anthropic forces a provider; otherwise we auto-pick
 *     Anthropic if ANTHROPIC_API_KEY is set, else OpenAI if OPENAI_API_KEY is.
 *   - Anthropic: claude-opus-4-8, structured JSON via output_config.format.
 *   - OpenAI:    OPENAI_MODEL (default "gpt-5.5"), JSON via response_format.
 *     ⚠️ The exact OpenAI model id isn't verified here — override OPENAI_MODEL
 *        in the environment if the API rejects the default.
 *
 * Privacy: callers pass already-extracted *text* (OCR / pdf.js runs in the
 * browser), so raw documents never leave the user's device for these features.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";

const MODEL = "claude-opus-4-8";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const MAX_INPUT_CHARS = 24_000; // trim very long docs before sending (short tasks)
const MAX_DOC_CHARS = 400_000; // ~100k tokens — full-document tasks (1M context)

type Provider = "anthropic" | "openai";

function forcedProvider(): Provider | null {
  const forced = (process.env.AI_PROVIDER || "").toLowerCase();
  if (forced === "openai") return "openai";
  if (forced === "anthropic") return "anthropic";
  return null;
}

function provider(): Provider {
  const forced = forcedProvider();
  if (forced) return forced;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "anthropic";
}

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
}

function providerEnabled(p: Provider): boolean {
  return p === "anthropic" ? !!process.env.ANTHROPIC_API_KEY : !!process.env.OPENAI_API_KEY;
}

function providerOrder(): Provider[] {
  const forced = forcedProvider();
  if (forced) return providerEnabled(forced) ? [forced] : [];
  const preferred = provider();
  const fallback: Provider = preferred === "anthropic" ? "openai" : "anthropic";
  return [preferred, fallback].filter(providerEnabled);
}

function isProviderAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("credit balance") ||
    message.includes("billing") ||
    message.includes("insufficient") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("invalid_request_error") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("api key")
  );
}

function publicAiError(): Error {
  return new Error("The AI service is temporarily unavailable. Please try again in a moment.");
}

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sdk = require("@anthropic-ai/sdk").default as new (opts?: unknown) => Anthropic;
    anthropicClient = new Sdk(); // reads ANTHROPIC_API_KEY from env
  }
  return anthropicClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sdk = require("openai").OpenAI as new (opts?: unknown) => OpenAI;
    openaiClient = new Sdk(); // reads OPENAI_API_KEY from env
  }
  return openaiClient;
}

function clip(text: string, max = MAX_INPUT_CHARS): string {
  return text.slice(0, max);
}

type StructuredOpts = {
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

/**
 * Run one structured-output request and return the parsed JSON object,
 * dispatching to whichever provider is configured.
 */
async function structured<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  opts: StructuredOpts = {},
): Promise<T> {
  const providers = providerOrder();
  let lastError: unknown;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    try {
      const raw =
        p === "openai"
          ? await openaiStructured(system, user, schema, opts)
          : await anthropicStructured(system, user, schema, opts);
      return JSON.parse(raw) as T;
    } catch (error) {
      lastError = error;
      const canFallback = i < providers.length - 1 && isProviderAccessError(error);
      if (!canFallback) break;
    }
  }
  console.warn("[ai] structured request failed", lastError instanceof Error ? lastError.message : lastError);
  throw publicAiError();
}

/**
 * Anthropic structured call. Large outputs (maxTokens > 4096) are streamed and
 * reassembled via .finalMessage() — per the SDK guidance, streaming avoids HTTP
 * timeouts on long generations. Short tasks use the non-streaming create().
 */
async function anthropicStructured(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  opts: StructuredOpts,
): Promise<string> {
  const max_tokens = opts.maxTokens ?? 1024;
  const params = {
    model: MODEL,
    max_tokens,
    output_config: { effort: opts.effort ?? "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  };

  if (max_tokens > 4096) {
    const stream = getClient().messages.stream(params as Anthropic.MessageCreateParamsStreaming);
    const msg = await stream.finalMessage();
    const block = msg.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "{}";
  }
  const res = await getClient().messages.create(
    params as Anthropic.MessageCreateParamsNonStreaming,
  );
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "{}";
}

/**
 * OpenAI structured call. Uses JSON mode (response_format json_object) with the
 * schema injected into the system prompt — robust across model variants without
 * depending on strict json_schema support. Newer models take
 * max_completion_tokens (max_tokens is rejected on reasoning models).
 */
async function openaiStructured(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  opts: StructuredOpts,
): Promise<string> {
  const sys =
    system +
    "\n\nRespond ONLY with a single JSON object that matches this JSON schema " +
    "(no markdown, no prose):\n" +
    JSON.stringify(schema);
  const res = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    max_completion_tokens: opts.maxTokens ?? 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  return res.choices?.[0]?.message?.content || "{}";
}

// Structured document model shared by reconstruct + translate.
export type DocBlock = {
  type: "heading" | "paragraph" | "list" | "table";
  level?: number;
  text?: string;
  items?: string[];
  rows?: string[][];
};

const DOC_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["heading", "paragraph", "list", "table"] },
          level: { type: "integer" },
          text: { type: "string" },
          items: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
        required: ["type"],
      },
    },
  },
  required: ["blocks"],
};

// ---- AI auto document naming ----------------------------------------------
export async function suggestName(text: string): Promise<{ name: string }> {
  return structured(
    "You name documents. Return a short, descriptive, filesystem-safe file name " +
      "(no extension, max 60 chars, words separated by hyphens) based on the document's content.",
    `Suggest a file name for this document:\n\n${clip(text)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  );
}

// ---- AI tagging / classification ------------------------------------------
export async function classify(
  text: string,
): Promise<{ category: string; tags: string[] }> {
  return structured(
    "You classify documents. Pick one high-level category (e.g. Invoice, Receipt, " +
      "Contract, Resume, Letter, Report, ID, Other) and 3-6 short lowercase topic tags.",
    `Classify this document:\n\n${clip(text)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["category", "tags"],
    },
  );
}

// ---- Receipt / invoice / contract data extraction -------------------------
export type ExtractType = "receipt" | "invoice" | "contract" | "resume";

export async function extract(
  text: string,
  docType: ExtractType,
): Promise<Record<string, unknown>> {
  const schemas: Record<ExtractType, Record<string, unknown>> = {
    receipt: {
      type: "object",
      additionalProperties: false,
      properties: {
        merchant: { type: "string" },
        date: { type: "string" },
        total: { type: "string" },
        tax: { type: "string" },
        currency: { type: "string" },
        category: { type: "string" },
        items: { type: "array", items: { type: "string" } },
      },
      required: ["merchant", "date", "total"],
    },
    invoice: {
      type: "object",
      additionalProperties: false,
      properties: {
        invoiceNumber: { type: "string" },
        vendor: { type: "string" },
        billedTo: { type: "string" },
        issueDate: { type: "string" },
        dueDate: { type: "string" },
        total: { type: "string" },
        currency: { type: "string" },
      },
      required: ["vendor", "total"],
    },
    contract: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        parties: { type: "array", items: { type: "string" } },
        effectiveDate: { type: "string" },
        termLength: { type: "string" },
        governingLaw: { type: "string" },
        summary: { type: "string" },
      },
      required: ["parties", "summary"],
    },
    resume: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        title: { type: "string" },
        yearsExperience: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        education: { type: "array", items: { type: "string" } },
      },
      required: ["name", "skills"],
    },
  };

  return structured(
    `You extract structured data from a ${docType}. Use empty strings for fields ` +
      "you can't find; never invent values.",
    `Extract the ${docType} fields from this document:\n\n${clip(text)}`,
    schemas[docType],
  );
}

// ---- A2: "Make editable" — reconstruct a clean structured document ---------
export async function reconstruct(text: string): Promise<{ blocks: DocBlock[] }> {
  return structured(
    "You convert raw extracted document text (from a PDF or OCR) into a clean, " +
      "editable structured document. Return an ordered array of blocks. Preserve " +
      "the reading order, headings, paragraphs, bullet/numbered lists and tables. " +
      "For headings set a level (1 = title, 2 = section, 3 = subsection). For lists " +
      "use items[]; for tables use rows[] (first row = header). Fix obvious OCR line-" +
      "break artefacts by rejoining wrapped lines, but never invent or summarise content.",
    `Reconstruct this document into editable blocks:\n\n${clip(text, MAX_DOC_CHARS)}`,
    DOC_SCHEMA,
    { maxTokens: 16_000, effort: "medium" },
  );
}

// ---- B2: AI auto-redaction — detect PII spans ------------------------------
export type RedactType =
  | "name"
  | "email"
  | "phone"
  | "card"
  | "id"
  | "address"
  | "other";

export async function detectRedactions(
  text: string,
): Promise<{ spans: { text: string; type: RedactType }[] }> {
  return structured(
    "You find personally identifiable information (PII) in a document so it can be " +
      "redacted. Return the exact substrings to redact and their type: name, email, " +
      "phone, card (payment card numbers), id (national/ID/SSN/passport numbers), " +
      "address, or other. Copy each span verbatim as it appears in the text (so it can " +
      "be located again). Don't include common words; only genuine sensitive values.",
    `Find the PII to redact in this document:\n\n${clip(text, MAX_DOC_CHARS)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        spans: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              type: {
                type: "string",
                enum: ["name", "email", "phone", "card", "id", "address", "other"],
              },
            },
            required: ["text", "type"],
          },
        },
      },
      required: ["spans"],
    },
    { maxTokens: 8_000, effort: "medium" },
  );
}

// ---- B3: AI translate document --------------------------------------------
export async function translateDoc(
  text: string,
  targetLang: string,
): Promise<{ blocks: DocBlock[] }> {
  return structured(
    `You translate documents into ${targetLang}. Return the document as an ordered ` +
      "array of blocks (headings, paragraphs, lists, tables) with all text translated " +
      `into ${targetLang}. Preserve structure and meaning; translate naturally rather ` +
      "than word-for-word. Do not add commentary.",
    `Translate this document into ${targetLang}:\n\n${clip(text, MAX_DOC_CHARS)}`,
    DOC_SCHEMA,
    { maxTokens: 16_000, effort: "medium" },
  );
}

// ---- UI string translation (powers <AutoTranslate/>) ----------------------
/**
 * Translate an array of short UI strings into `targetLang`, preserving order
 * and array length so the caller can map results back 1:1. Brand names, code,
 * URLs, numbers and placeholders are left untouched. Used to localize the whole
 * site at runtime; results are cached client-side so each string is paid once.
 */
export async function translateUiStrings(
  strings: string[],
  targetLang: string,
): Promise<{ translations: string[] }> {
  const res = await structured<{ translations: string[] }>(
    `You localize a web app's interface into ${targetLang}. You receive a JSON array of UI ` +
      `strings (labels, buttons, headings, sentences). Return a "translations" array with each ` +
      `string translated naturally into ${targetLang}, in the SAME ORDER and with the SAME ` +
      `LENGTH as the input. Keep the product name "DocuScan" and any other proper nouns, file ` +
      `extensions (PDF, DOCX), URLs, code and bracketed placeholders like [Name] unchanged. ` +
      `Translate the meaning, not word-for-word. Return only the array.`,
    JSON.stringify(strings),
    {
      type: "object",
      additionalProperties: false,
      properties: { translations: { type: "array", items: { type: "string" } } },
      required: ["translations"],
    },
    { maxTokens: 8_000, effort: "low" },
  );
  return res;
}

// ---- B4: Document compare / redline ---------------------------------------
export type CompareResult = {
  summary: string;
  added: string[];
  removed: string[];
  changed: { before: string; after: string }[];
};

export async function compareDocs(a: string, b: string): Promise<CompareResult> {
  return structured(
    "You compare two versions of a document (A = original, B = revised) and produce a " +
      "redline. Return: a short plain-language summary of what changed; added[] (text " +
      "present only in B); removed[] (text present only in A); and changed[] (a before/" +
      "after pair for each meaningfully reworded passage). Focus on substantive changes, " +
      "not whitespace. Quote text concisely.",
    `Document A (original):\n\n${clip(a, MAX_DOC_CHARS / 2)}\n\n---\n\nDocument B (revised):\n\n${clip(
      b,
      MAX_DOC_CHARS / 2,
    )}`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        added: { type: "array", items: { type: "string" } },
        removed: { type: "array", items: { type: "string" } },
        changed: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { before: { type: "string" }, after: { type: "string" } },
            required: ["before", "after"],
          },
        },
      },
      required: ["summary", "added", "removed", "changed"],
    },
    { maxTokens: 12_000, effort: "medium" },
  );
}

// ---- C1: Summarize a document (multiple modes) ----------------------------
// Back-compat alias: the original three "lengths" are still valid modes.
export type SummaryLength = "brief" | "standard" | "detailed";

export type SummaryMode =
  | "brief"
  | "standard"
  | "detailed"
  | "bullets"
  | "executive"
  | "student"
  | "actions"
  | "meeting"
  | "risk"
  | "contract"
  | "financial"
  | "research"
  | "policy"
  | "email"
  | "eli10"
  | "professional";

export type SummaryResult = {
  tldr: string;
  keyPoints: string[];
  actionItems: string[];
};

// Each mode tailors only the *instruction*; the output contract stays
// {tldr, keyPoints, actionItems} so the UI/export path is identical everywhere.
const SUMMARY_MODES: Record<SummaryMode, string> = {
  brief: "Give a one-or-two-sentence TL;DR and up to 3 key points.",
  standard: "Give a short-paragraph TL;DR and 4-6 key points.",
  detailed: "Give a full-paragraph TL;DR and 6-10 key points covering the document thoroughly.",
  bullets:
    "Keep the TL;DR to a single sentence and put everything else as 6-12 tight, scannable bullet key points.",
  executive:
    "Write an executive summary for a busy decision-maker: a confident paragraph TL;DR focused on outcomes, " +
    "impact and recommendations, then 4-6 high-level key points. Lead with what matters most.",
  student:
    "Produce study notes: a one-line TL;DR, then key points as clear, memorable revision notes (definitions, " +
    "concepts, cause/effect) a student could learn from.",
  actions:
    "Focus on what to DO. Keep the TL;DR to one line; leave key points brief; put every concrete task, deadline, " +
    "owner and follow-up in action items (each starting with a verb). This is an action-item extraction.",
  meeting:
    "Write meeting notes: a one-line TL;DR of the meeting's purpose/outcome, key points as decisions and " +
    "discussion highlights, and action items as owned next steps (include who/when if stated).",
  risk:
    "Write a risk summary: TL;DR of the overall risk picture, then key points each describing a risk, concern, " +
    "liability or red flag and why it matters. Action items = recommended mitigations.",
  contract:
    "Summarize this as a contract/agreement: TL;DR of what the agreement does, key points covering parties, term, " +
    "payment, obligations, termination, renewal and governing law (only those present). Note this is not legal advice.",
  financial:
    "Write a financial summary: TL;DR of the financial picture, key points covering figures, totals, trends, " +
    "inflows/outflows, amounts and dates. Quote numbers exactly; never estimate or invent figures.",
  research:
    "Summarize this research/academic paper: TL;DR of the core finding, key points covering objective, method, " +
    "results and conclusions. Action items = limitations or future-work noted by the authors.",
  policy:
    "Summarize this policy/procedure: TL;DR of its purpose and scope, key points covering the main rules, " +
    "requirements and who/what it applies to. Action items = required steps or compliance obligations.",
  email:
    "Write the summary as a short, friendly email body: the TL;DR reads like the opening of an email recapping the " +
    "document, key points are the highlights worth flagging, action items are any asks or next steps.",
  eli10:
    "Explain it like I'm 10: a warm, simple TL;DR using everyday words and short sentences, key points as simple " +
    "takeaways. Avoid jargon; if a hard word is unavoidable, explain it in plain terms.",
  professional:
    "Explain it as a knowledgeable professional briefing a peer: a precise, well-structured TL;DR and key points " +
    "using correct domain terminology, assuming an informed reader.",
};

export async function summarize(
  text: string,
  mode: SummaryMode = "standard",
): Promise<SummaryResult> {
  const instruction = SUMMARY_MODES[mode] ?? SUMMARY_MODES.standard;
  return structured(
    "You summarize documents faithfully. " +
      instruction +
      " Put the main summary in `tldr`, supporting points/notes/highlights in `keyPoints`, and any " +
      "concrete next steps, deadlines or follow-ups in `actionItems` (empty array if none). Ground " +
      "everything in the document; never invent facts, figures or names.",
    `Summarize this document:\n\n${clip(text, MAX_DOC_CHARS)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        tldr: { type: "string" },
        keyPoints: { type: "array", items: { type: "string" } },
        actionItems: { type: "array", items: { type: "string" } },
      },
      required: ["tldr", "keyPoints", "actionItems"],
    },
    { maxTokens: 4_000, effort: "medium" },
  );
}

export const SUMMARY_MODE_KEYS = Object.keys(SUMMARY_MODES) as SummaryMode[];

// ---- C2: Rewrite / simplify a document ------------------------------------
export type RewriteStyle =
  | "simplify"
  | "shorten"
  | "formal"
  | "friendly"
  | "professional";

export async function rewriteDoc(
  text: string,
  style: RewriteStyle,
): Promise<{ blocks: DocBlock[] }> {
  const instructions: Record<RewriteStyle, string> = {
    simplify:
      "Rewrite it in plain, everyday language at roughly an 8th-grade reading level. " +
      "Use short sentences and explain jargon, but keep all the facts and meaning.",
    shorten:
      "Rewrite it to be significantly shorter and tighter, cutting filler and repetition " +
      "while keeping every important point, figure and name.",
    formal:
      "Rewrite it in a formal, polished tone suitable for an official or legal context, " +
      "without changing the meaning.",
    friendly:
      "Rewrite it in a warm, friendly and approachable tone, without changing the meaning.",
    professional:
      "Rewrite it in a clear, confident, professional business tone, without changing the meaning.",
  };
  return structured(
    "You rewrite documents. " +
      instructions[style] +
      " Return the result as an ordered array of blocks (headings, paragraphs, lists, tables) " +
      "preserving the document's structure. Do not add commentary or invent content.",
    `Rewrite this document:\n\n${clip(text, MAX_DOC_CHARS)}`,
    DOC_SCHEMA,
    { maxTokens: 16_000, effort: "medium" },
  );
}

// ---- C3: Contract / legal analysis ----------------------------------------
export type RiskSeverity = "low" | "medium" | "high";

export type AnalysisResult = {
  overview: string;
  parties: string[];
  keyTerms: { label: string; value: string }[];
  obligations: string[];
  risks: { clause: string; severity: RiskSeverity; explanation: string }[];
};

export async function analyzeContract(text: string): Promise<AnalysisResult> {
  return structured(
    "You are a contract analyst helping a non-lawyer understand an agreement. Produce: a " +
      "plain-English overview; the parties; key terms as label/value pairs (e.g. Effective date, " +
      "Term length, Governing law, Payment, Termination, Renewal — only those present); the main " +
      "obligations of each side in plain language; and risks — clauses that are unusual, one-sided, " +
      "vague or potentially unfavourable, each with a severity (low/medium/high) and a short plain-" +
      "English explanation of why it matters. Ground everything in the document; never invent terms. " +
      "Use empty arrays where nothing applies. This is informational, not legal advice.",
    `Analyze this contract:\n\n${clip(text, MAX_DOC_CHARS)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        overview: { type: "string" },
        parties: { type: "array", items: { type: "string" } },
        keyTerms: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { label: { type: "string" }, value: { type: "string" } },
            required: ["label", "value"],
          },
        },
        obligations: { type: "array", items: { type: "string" } },
        risks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              clause: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high"] },
              explanation: { type: "string" },
            },
            required: ["clause", "severity", "explanation"],
          },
        },
      },
      required: ["overview", "parties", "keyTerms", "obligations", "risks"],
    },
    { maxTokens: 8_000, effort: "high" },
  );
}

// ---- C4: Draft from a document --------------------------------------------
export type DraftKind = "email-reply" | "cover-letter" | "memo" | "follow-up";

export async function draftFromDoc(
  text: string,
  kind: DraftKind,
  instructions: string,
): Promise<{ title: string; body: string }> {
  const what: Record<DraftKind, string> = {
    "email-reply": "a professional email reply responding to this document",
    "cover-letter": "a tailored cover letter based on this document (e.g. a job posting or résumé)",
    memo: "a concise internal memo summarizing this document and its implications",
    "follow-up": "a polite follow-up message about this document (e.g. chasing a reply or next steps)",
  };
  const extra = instructions.trim()
    ? `\n\nFollow these extra instructions from the user: ${instructions.trim()}`
    : "";
  return structured(
    "You draft correspondence based on a source document. Write " +
      what[kind] +
      ". Return a title (subject line for emails, or a heading otherwise) and the body text. " +
      "Use a natural, appropriate tone, ground it in the document, and leave clearly-marked " +
      "placeholders like [Name] only where information genuinely isn't available. Do not invent facts." +
      extra,
    `Source document:\n\n${clip(text)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: { title: { type: "string" }, body: { type: "string" } },
      required: ["title", "body"],
    },
    { maxTokens: 4_000, effort: "medium" },
  );
}

// ---- C5: Study aids — flashcards + quiz ------------------------------------
export type StudyResult = {
  flashcards: { front: string; back: string }[];
  quiz: { question: string; options: string[]; answerIndex: number; explanation: string }[];
};

export async function studyAids(text: string): Promise<StudyResult> {
  return structured(
    "You turn study material into learning aids. Produce 6-12 flashcards (front = a question " +
      "or term, back = the answer/definition) and 4-8 multiple-choice quiz questions. Each quiz " +
      "question has exactly 4 options, answerIndex is the 0-based index of the correct option, and " +
      "a short explanation. Cover the most important concepts. Ground everything in the document; " +
      "never invent facts.",
    `Create study aids from this document:\n\n${clip(text, MAX_DOC_CHARS)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        flashcards: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { front: { type: "string" }, back: { type: "string" } },
            required: ["front", "back"],
          },
        },
        quiz: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              answerIndex: { type: "integer" },
              explanation: { type: "string" },
            },
            required: ["question", "options", "answerIndex", "explanation"],
          },
        },
      },
      required: ["flashcards", "quiz"],
    },
    { maxTokens: 8_000, effort: "medium" },
  );
}

// ---- Resume / CV review (extract + summary + JD fit + interview questions) -
export type ResumeResult = {
  name: string;
  email: string;
  phone: string;
  title: string;
  yearsExperience: string;
  skills: string[];
  education: string[];
  experience: string[];
  summary: string;
  fit: string; // assessment against the job description ("" if none supplied)
  strengths: string[];
  gaps: string[];
  questions: { question: string; rationale: string }[];
};

export async function reviewResume(
  text: string,
  jobDescription: string,
): Promise<ResumeResult> {
  const jd = jobDescription.trim();
  const jdBlock = jd
    ? `\n\nJOB DESCRIPTION to assess the candidate against:\n\n${clip(jd, 8_000)}`
    : "";
  return structured(
    "You are a recruiting assistant that helps a human screen a CV/résumé. Extract the " +
      "candidate's details (use empty strings/arrays where missing; never invent data), write a " +
      "short neutral `summary`, and produce 6-10 interview `questions` (each with a one-line " +
      "`rationale` for why to ask it). If a job description is provided, fill `fit` with a balanced " +
      "plain-English assessment of how well the candidate matches it, plus `strengths` and `gaps`; " +
      "if none is provided, set `fit` to an empty string and base strengths/gaps on the résumé alone. " +
      "This is decision support only — a human must make the hiring decision.",
    `Review this résumé:${jdBlock}\n\nRÉSUMÉ:\n\n${clip(text, MAX_DOC_CHARS)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        title: { type: "string" },
        yearsExperience: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        education: { type: "array", items: { type: "string" } },
        experience: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
        fit: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
        questions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { question: { type: "string" }, rationale: { type: "string" } },
            required: ["question", "rationale"],
          },
        },
      },
      required: [
        "name", "email", "phone", "title", "yearsExperience", "skills", "education",
        "experience", "summary", "fit", "strengths", "gaps", "questions",
      ],
    },
    { maxTokens: 8_000, effort: "medium" },
  );
}

// ---- Extract anything to a table (custom fields + presets) -----------------
export type TableResult = {
  columns: string[];
  rows: { values: string[]; confidence: number }[];
  notes: string;
};

const TABLE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    columns: { type: "array", items: { type: "string" } },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          values: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        },
        required: ["values", "confidence"],
      },
    },
    notes: { type: "string" },
  },
  required: ["columns", "rows", "notes"],
};

/**
 * Pull structured tabular data out of any document. `fields` (when supplied)
 * fixes the columns and their order; otherwise the model chooses the most
 * useful columns from `instruction`. Documents with many records (bank
 * transactions, invoice line items, attendance rows, business cards…) return
 * one row each, with a per-row confidence so the UI can flag shaky extractions.
 */
export async function extractTable(
  text: string,
  fields: string[],
  instruction: string,
): Promise<TableResult> {
  const cols = fields.map((f) => f.trim()).filter(Boolean);
  const colGuide = cols.length
    ? `Use exactly these columns, in this order: ${cols.join(", ")}.`
    : "Choose the most useful columns yourself based on the request and the document.";
  return structured(
    "You extract structured tabular data from a document. " +
      colGuide +
      " A document may contain many records (transactions, line items, people, form rows, etc.) — " +
      "return one row per record. If the request narrows the scope, extract only that section and " +
      "ignore unrelated pages, summaries, totals, checklists, examples, and other tables unless the " +
      "request explicitly asks for them. Do not merge different document sections into one table. " +
      "Each row's `values` array must align 1:1 with `columns` (use an " +
      "empty string where a value is missing; never invent data). Give each row a `confidence` " +
      "between 0 and 1 for how sure you are it was read correctly. Put any caveats (ambiguous or " +
      "unreadable parts) in `notes`, else an empty string.",
    `${instruction.trim() ? "Request: " + instruction.trim() + "\n\n" : ""}Extract a table from this document:\n\n${clip(
      text,
      MAX_DOC_CHARS,
    )}`,
    TABLE_SCHEMA,
    { maxTokens: 12_000, effort: "medium" },
  );
}

// ---- Document → presentation: slide deck ----------------------------------
export type SlideStyle = "professional" | "academic" | "pitch" | "simple";

export type Slide = { title: string; bullets: string[]; notes: string };
export type DeckResult = { title: string; subtitle: string; slides: Slide[] };

export async function buildDeck(
  text: string,
  style: SlideStyle,
): Promise<DeckResult> {
  const guide: Record<SlideStyle, string> = {
    professional:
      "a clean professional business deck: crisp, outcome-focused slide titles and tight bullets",
    academic:
      "an academic lecture deck: logical sections (background, method, findings, conclusions), precise wording",
    pitch:
      "a startup pitch deck: punchy, persuasive slide titles and short high-impact bullets, building a narrative",
    simple:
      "a simple, clear deck for a general audience: plain titles and short, easy bullets",
  };
  return structured(
    "You turn a document into " +
      guide[style] +
      ". Return a deck title, a short subtitle, and an ordered array of slides. Each slide has a short " +
      "title, 2-5 concise bullet points (a few words to one line each — not full paragraphs), and optional " +
      "speaker `notes` (1-3 sentences, empty string if none). Aim for 5-12 slides covering the document " +
      "well, starting with a title/overview slide and ending with a summary or conclusions slide. Ground " +
      "everything in the document; never invent facts, figures or names.",
    `Create a presentation from this document:\n\n${clip(text, MAX_DOC_CHARS)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        slides: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              bullets: { type: "array", items: { type: "string" } },
              notes: { type: "string" },
            },
            required: ["title", "bullets", "notes"],
          },
        },
      },
      required: ["title", "subtitle", "slides"],
    },
    { maxTokens: 12_000, effort: "medium" },
  );
}

// ---- Document → audio: narration script -----------------------------------
export type NarrateStyle = "summary" | "explainer" | "study" | "podcast";

/**
 * Turn a document into a spoken-word script for text-to-speech. The "full" read
 * needs no AI (the page just speaks the extracted text); these styles rewrite
 * the document into something pleasant to listen to. Returns plain prose with
 * no markdown/headings/bullets so a TTS voice reads it naturally.
 */
export async function narrateScript(
  text: string,
  style: NarrateStyle,
): Promise<{ script: string }> {
  const guide: Record<NarrateStyle, string> = {
    summary:
      "a concise spoken summary (roughly 30-90 seconds of audio) covering the key points",
    explainer:
      "a clear spoken explanation that walks the listener through the document and what it means",
    study:
      "a study-friendly narration that explains the key concepts and definitions a learner should remember, " +
      "in a calm teaching tone",
    podcast:
      "a friendly, engaging single-host podcast-style segment that explains the document conversationally, " +
      "with a short spoken intro and wrap-up",
  };
  return structured(
    "You write narration scripts for text-to-speech. Produce " +
      guide[style] +
      ". Write flowing spoken prose only — no headings, bullet points, markdown, stage directions or " +
      "speaker labels. Use natural sentences a voice can read aloud. Ground everything in the document; " +
      "never invent facts, figures or names.",
    `Write a narration script for this document:\n\n${clip(text, MAX_DOC_CHARS)}`,
    {
      type: "object",
      additionalProperties: false,
      properties: { script: { type: "string" } },
      required: ["script"],
    },
    { maxTokens: 8_000, effort: "medium" },
  );
}

// ---- B1: Chat with your document (streaming) ------------------------------
export type ChatTurn = { role: "user" | "assistant"; content: string };

const CHAT_SYSTEM =
  "You answer questions about the document below. Be accurate and concise, and ground " +
  "every answer in the document — if the answer isn't in it, say so. Use clean prose and " +
  "simple bullet lists when useful, but do not use markdown emphasis markers like **bold**. " +
  "Only the document's text was provided (the file itself stays on the user's device).";

/**
 * Stream an answer to a question about a document as plain text chunks, from
 * whichever provider is configured. The route just pipes the chunks through.
 */
export function chatStream(
  text: string,
  question: string,
  history: ChatTurn[],
): AsyncIterable<string> {
  return chatStreamWithFallback(text, question, history);
}

async function* chatStreamWithFallback(
  text: string,
  question: string,
  history: ChatTurn[],
): AsyncGenerator<string> {
  const turns = history.slice(-10).map((t) => ({ role: t.role, content: t.content }));
  const doc = clip(text, MAX_DOC_CHARS);
  const providers = providerOrder();
  let lastError: unknown;
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    try {
      const stream = p === "openai"
        ? openaiChatStream(doc, question, turns)
        : anthropicChatStream(doc, question, turns);
      for await (const chunk of stream) yield chunk;
      return;
    } catch (error) {
      lastError = error;
      const canFallback = i < providers.length - 1 && isProviderAccessError(error);
      if (!canFallback) break;
    }
  }
  console.warn("[ai] chat request failed", lastError instanceof Error ? lastError.message : lastError);
  throw publicAiError();
}

async function* anthropicChatStream(
  doc: string,
  question: string,
  turns: ChatTurn[],
): AsyncGenerator<string> {
  // Document goes in a cached system prefix so multi-turn chat reuses it cheaply.
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 4_000,
    output_config: { effort: "low" },
    system: [
      { type: "text", text: CHAT_SYSTEM },
      {
        type: "text",
        text: `DOCUMENT:\n\n${doc}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [...turns, { role: "user", content: question }] as Anthropic.MessageParam[],
  } as Anthropic.MessageCreateParamsStreaming);

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

async function* openaiChatStream(
  doc: string,
  question: string,
  turns: ChatTurn[],
): AsyncGenerator<string> {
  const stream = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    max_completion_tokens: 4_000,
    stream: true,
    messages: [
      { role: "system", content: `${CHAT_SYSTEM}\n\nDOCUMENT:\n\n${doc}` },
      ...turns.map((t) => ({ role: t.role, content: t.content }) as const),
      { role: "user", content: question },
    ],
  });
  for await (const chunk of stream) {
    const t = chunk.choices?.[0]?.delta?.content;
    if (t) yield t;
  }
}

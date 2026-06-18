import { NextRequest, NextResponse } from "next/server";
import {
  aiEnabled,
  suggestName,
  classify,
  extract,
  reconstruct,
  detectRedactions,
  translateDoc,
  compareDocs,
  summarize,
  rewriteDoc,
  analyzeContract,
  draftFromDoc,
  studyAids,
  extractTable,
  reviewResume,
  narrateScript,
  buildDeck,
  chatStream,
  SUMMARY_MODE_KEYS,
  type ExtractType,
  type ChatTurn,
  type SummaryMode,
  type RewriteStyle,
  type DraftKind,
  type NarrateStyle,
  type SlideStyle,
} from "@/lib/ai";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

/**
 * AI document features: POST { task, text, ... }.
 *   task "name"          -> { name }
 *   task "tags"          -> { category, tags }
 *   task "extract"       -> structured fields (docType: receipt|invoice|contract)
 *   task "reconstruct"   -> { blocks }                 (A2: make editable)
 *   task "redact-detect" -> { spans }                  (B2: auto-redaction)
 *   task "translate"     -> { blocks } (targetLang)    (B3: translate)
 *   task "compare"       -> { summary, added, ... } (textB) (B4: redline)
 *   task "summarize"     -> { tldr, keyPoints, actionItems } (length) (C1)
 *   task "rewrite"       -> { blocks } (style)               (C2: rewrite)
 *   task "analyze"       -> { overview, parties, ... }        (C3: contract analysis)
 *   task "draft"         -> { title, body } (kind, instructions) (C4: draft)
 *   task "study"         -> { flashcards, quiz }              (C5: study aids)
 *   task "chat"          -> streamed text (question, history) (B1: chat)
 *
 * Disabled (503) unless ANTHROPIC_API_KEY is set. Calls cost money + hit a
 * third party, so the rate limit is tight: 10 / 5 min / IP.
 */

export const dynamic = "force-dynamic";

const EXTRACT_TYPES: ExtractType[] = ["receipt", "invoice", "contract", "resume"];

export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "AI features are not enabled on this server." },
      { status: 503 },
    );
  }

  const rl = await rateLimit(`ai:${clientIp(req)}`, { limit: 10, windowSec: 300 });
  if (!rl.allowed) return tooManyRequests(rl);

  let body: {
    task?: string;
    text?: string;
    textB?: string;
    docType?: string;
    targetLang?: string;
    length?: string;
    mode?: string;
    style?: string;
    kind?: string;
    instructions?: string;
    fields?: unknown[];
    question?: string;
    history?: ChatTurn[];
    jobDescription?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "No document text provided." }, { status: 400 });

  try {
    switch (body.task) {
      case "name":
        return NextResponse.json(await suggestName(text));
      case "tags":
        return NextResponse.json(await classify(text));
      case "extract": {
        const docType = (body.docType ?? "receipt") as ExtractType;
        if (!EXTRACT_TYPES.includes(docType)) {
          return NextResponse.json({ error: "Invalid docType." }, { status: 400 });
        }
        return NextResponse.json(await extract(text, docType));
      }
      case "reconstruct":
        return NextResponse.json(await reconstruct(text));
      case "redact-detect":
        return NextResponse.json(await detectRedactions(text));
      case "translate": {
        const targetLang = (body.targetLang ?? "").trim();
        if (!targetLang) {
          return NextResponse.json({ error: "No target language provided." }, { status: 400 });
        }
        return NextResponse.json(await translateDoc(text, targetLang));
      }
      case "compare": {
        const textB = typeof body.textB === "string" ? body.textB.trim() : "";
        if (!textB) {
          return NextResponse.json({ error: "Provide both documents to compare." }, { status: 400 });
        }
        return NextResponse.json(await compareDocs(text, textB));
      }
      case "summarize": {
        // `mode` is the new field; fall back to the legacy `length` for compatibility.
        const requested = (body.mode ?? body.length) as SummaryMode;
        const mode = SUMMARY_MODE_KEYS.includes(requested) ? requested : "standard";
        return NextResponse.json(await summarize(text, mode));
      }
      case "rewrite": {
        const styles: RewriteStyle[] = [
          "simplify",
          "shorten",
          "formal",
          "friendly",
          "professional",
        ];
        if (!styles.includes(body.style as RewriteStyle)) {
          return NextResponse.json({ error: "Invalid rewrite style." }, { status: 400 });
        }
        return NextResponse.json(await rewriteDoc(text, body.style as RewriteStyle));
      }
      case "analyze":
        return NextResponse.json(await analyzeContract(text));
      case "draft": {
        const kinds: DraftKind[] = ["email-reply", "cover-letter", "memo", "follow-up"];
        if (!kinds.includes(body.kind as DraftKind)) {
          return NextResponse.json({ error: "Invalid draft kind." }, { status: 400 });
        }
        const instructions = typeof body.instructions === "string" ? body.instructions : "";
        return NextResponse.json(await draftFromDoc(text, body.kind as DraftKind, instructions));
      }
      case "study":
        return NextResponse.json(await studyAids(text));
      case "resume-review": {
        const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription : "";
        return NextResponse.json(await reviewResume(text, jobDescription));
      }
      case "extract-table": {
        const fields = Array.isArray(body.fields)
          ? body.fields.filter((f): f is string => typeof f === "string")
          : [];
        const instruction = typeof body.instructions === "string" ? body.instructions : "";
        if (!fields.length && !instruction.trim()) {
          return NextResponse.json(
            { error: "Provide columns to extract or describe what to pull out." },
            { status: 400 },
          );
        }
        return NextResponse.json(await extractTable(text, fields, instruction));
      }
      case "narrate": {
        const styles: NarrateStyle[] = ["summary", "explainer", "study", "podcast"];
        if (!styles.includes(body.style as NarrateStyle)) {
          return NextResponse.json({ error: "Invalid narration style." }, { status: 400 });
        }
        return NextResponse.json(await narrateScript(text, body.style as NarrateStyle));
      }
      case "slides": {
        const styles: SlideStyle[] = ["professional", "academic", "pitch", "simple"];
        if (!styles.includes(body.style as SlideStyle)) {
          return NextResponse.json({ error: "Invalid presentation style." }, { status: 400 });
        }
        return NextResponse.json(await buildDeck(text, body.style as SlideStyle));
      }
      case "chat": {
        const question = (body.question ?? "").trim();
        if (!question) {
          return NextResponse.json({ error: "No question provided." }, { status: 400 });
        }
        const history = Array.isArray(body.history) ? body.history : [];
        const stream = chatStream(text, question, history);
        const encoder = new TextEncoder();
        const rs = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const chunk of stream) {
                controller.enqueue(encoder.encode(chunk));
              }
            } catch {
              controller.enqueue(
                encoder.encode(
                  `\nI couldn't reach the AI service right now. Please try again in a moment.`,
                ),
              );
            } finally {
              controller.close();
            }
          },
        });
        return new Response(rs, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      default:
        return NextResponse.json({ error: "Unknown task." }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

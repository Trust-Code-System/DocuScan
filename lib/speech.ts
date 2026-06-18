/**
 * Browser text-to-speech helper for the Document → Audio tool.
 *
 * Uses the Web Speech API (SpeechSynthesis) — fully on-device, no API cost and
 * no network. Long text is split into short, sentence-aligned chunks: this both
 * keeps each utterance under the engine's length cap and sidesteps Chrome's
 * ~15s cut-off bug (short utterances finish before it triggers).
 *
 * NOTE: browser SpeechSynthesis plays to the audio output and cannot be captured
 * to a file via the standard APIs, so there's no reliable in-browser MP3 export.
 * The tool offers a script (.txt) download instead; an MP3 export would need a
 * server-side / cloud TTS voice (a future integration seam).
 */

export type SpeakerState = "idle" | "speaking" | "paused";

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Voices load asynchronously in most browsers; resolve once they're available. */
export async function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return [];
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return now;
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(() => resolve(synth.getVoices()), 1200); // fallback if the event never fires
  });
}

/** Split into TTS-friendly chunks: sentence-aligned, capped length. */
export function chunkForSpeech(text: string, max = 200): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [clean];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur) {
      chunks.push(cur.trim());
      cur = "";
    }
    cur += s + " ";
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

/**
 * Queue-based speaker. Reads chunks in order, supports pause/resume/stop and
 * reports progress. Rate/voice/pitch changes apply from the next chunk.
 */
export class Speaker {
  private chunks: string[] = [];
  private idx = 0;
  private running = false;
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  pitch = 1;
  onState?: (s: SpeakerState) => void;
  onProgress?: (done: number, total: number) => void;

  get total(): number {
    return this.chunks.length;
  }

  load(text: string): void {
    this.stop();
    this.chunks = chunkForSpeech(text);
    this.idx = 0;
    this.onProgress?.(0, this.total);
  }

  play(): void {
    if (!speechSupported() || !this.chunks.length) return;
    if (this.running) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        this.onState?.("speaking");
      }
      return;
    }
    this.running = true;
    this.onState?.("speaking");
    this.next();
  }

  private next(): void {
    if (!this.running) return;
    if (this.idx >= this.chunks.length) {
      this.running = false;
      this.idx = 0;
      this.onProgress?.(this.total, this.total);
      this.onState?.("idle");
      return;
    }
    const u = new SpeechSynthesisUtterance(this.chunks[this.idx]);
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate;
    u.pitch = this.pitch;
    u.onend = () => {
      if (!this.running) return;
      this.idx++;
      this.onProgress?.(this.idx, this.total);
      this.next();
    };
    u.onerror = () => {
      if (!this.running) return;
      this.idx++;
      this.next();
    };
    window.speechSynthesis.speak(u);
  }

  pause(): void {
    if (this.running && speechSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.onState?.("paused");
    }
  }

  stop(): void {
    this.running = false;
    this.idx = 0;
    if (speechSupported()) window.speechSynthesis.cancel();
    this.onState?.("idle");
    this.onProgress?.(0, this.total);
  }
}

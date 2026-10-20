import { must } from "../guards.ts";
import type { Satisfies, Speech } from "./contracts.ts";
import type * as Self from "./speech.web.ts";
// The browser speech API; Chrome and Safari still ship it under the webkit prefix.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;
declare global {
  var SpeechRecognition: RecognitionConstructor | undefined;
  var webkitSpeechRecognition: RecognitionConstructor | undefined;
}
let active: Recognition | null = null;
export function speechSupported(): boolean {
  return !!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
}
export async function recognizeSpeech(language = "en-BH"): Promise<string> {
  const Recognition =
    globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!Recognition)
    throw Error(
      "Speech capture is not supported in this browser. Use text entry or your keyboard's dictation.",
    );
  if (active) throw Error("A speech capture is already running.");
  return await new Promise<string>((resolve, reject) => {
    const recognition = new Recognition();
    active = recognition;
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      recognition.abort();
      finish(new Error("Speech capture timed out. Try again or enter text."));
    }, 30000);
    function finish(error: unknown, text?: string) {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      active = null;
      error ? reject(error) : resolve(text || "");
    }
    recognition.onresult = (event) => {
      recognition.stop();
      finish(
        null,
        Array.from(event.results)
          // Every recognition result carries at least one alternative.
          .map((result) => must(result[0], "speech alternative").transcript)
          .join(" "),
      );
    };
    recognition.onerror = (event) =>
      finish(
        new Error(
          `Speech capture failed (${event.error}). Use text entry if permission is unavailable.`,
        ),
      );
    recognition.onend = () => finish(null, "");
    try {
      recognition.start();
    } catch (error) {
      finish(error);
    }
  });
}
export async function stopSpeech(): Promise<void> {
  active?.stop();
}
// Compile-time check that this module matches the speech contract.
export type SpeechCheck = Satisfies<Speech, typeof Self>;

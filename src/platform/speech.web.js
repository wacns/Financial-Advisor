let active = null;
export function speechSupported() {
  return !!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
}
export async function recognizeSpeech(language = "en-BH") {
  const Recognition =
    globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!Recognition)
    throw Error(
      "Speech capture is not supported in this browser. Use text entry or your keyboard's dictation.",
    );
  if (active) throw Error("A speech capture is already running.");
  return await new Promise((resolve, reject) => {
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
    function finish(error, text) {
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
          .map((result) => result[0].transcript)
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
export async function stopSpeech() {
  active?.stop();
}

import { must } from "../guards.ts";
import type {
  CaptureRequest,
  Files,
  PickedFile,
  QuickEntry,
  Satisfies,
} from "./contracts.ts";
import type * as Self from "./files.web.ts";
export async function pickFile({
  image = false,
}: { image?: boolean; camera?: boolean } = {}): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = image
      ? "image/png,image/jpeg,image/webp"
      : ".json,.csv,.txt,.pdf,image/png,image/jpeg,image/webp";
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      try {
        const file = must(input.files, "selected files")[0];
        if (!file) return resolve(null);
        if (file.size > 16000000)
          throw Error("File must be smaller than 16 MB.");
        const data = await new Promise<string>((yes, no) => {
          const reader = new FileReader();
          // readAsDataURL always produces a string result.
          reader.onload = () => yes(String(reader.result));
          reader.onerror = no;
          reader.readAsDataURL(file);
        });
        resolve({
          name: file.name,
          mime: file.type,
          data,
          uri: data,
          text: await file.text(),
          size: file.size,
        });
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}
// There is no camera on the web; the file picker is used either way.
export async function scanReceipt(_camera = false): Promise<string | null> {
  const file = await pickFile({ image: true });
  if (!file) return null;
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/",
    langPath: "/ocr",
  });
  try {
    return (await worker.recognize(file.uri)).data.text;
  } finally {
    await worker.terminate();
  }
}
export async function downloadAttachment(data: string, name: string): Promise<void> {
  const anchor = document.createElement("a");
  anchor.href = data;
  anchor.download = name.replace(/[\\/]/g, "_");
  anchor.click();
}
// Widgets, quick-entry links and capture links exist only in the mobile app.
export async function syncWidgets(
  _workspace: Parameters<Files["syncWidgets"]>[0],
  _owner: string | null | undefined,
): Promise<void> {}
export function subscribeQuickEntry(_callback: (entry: QuickEntry) => void): () => void {
  return () => {};
}
export function subscribeCapture(_callback: (capture: CaptureRequest) => void): () => void {
  return () => {};
}

export async function requestWidget(): Promise<boolean> {
  return false;
}
// Compile-time check that this module matches the files contract.
export type FilesCheck = Satisfies<Files, typeof Self>;

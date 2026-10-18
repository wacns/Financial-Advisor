export async function pickFile({ image = false } = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = image
      ? "image/png,image/jpeg,image/webp"
      : ".json,.csv,.txt,.pdf,image/png,image/jpeg,image/webp";
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      try {
        const file = input.files[0];
        if (!file) return resolve(null);
        if (file.size > 16000000)
          throw Error("File must be smaller than 16 MB.");
        const data = await new Promise((yes, no) => {
          const reader = new FileReader();
          reader.onload = () => yes(reader.result);
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
export async function scanReceipt() {
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
export async function downloadAttachment(data, name) {
  const anchor = document.createElement("a");
  anchor.href = data;
  anchor.download = name.replace(/[\\/]/g, "_");
  anchor.click();
}
export async function syncWidgets() {}
export function subscribeQuickEntry() {
  return () => {};
}

export async function requestWidget() {
  return false;
}

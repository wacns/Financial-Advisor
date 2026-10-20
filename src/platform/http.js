export async function requestJSON(url, options = {}, timeout = 15000) {
  const controller = new globalThis.AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await globalThis.fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok)
      throw Error(
        `The service is unavailable (HTTP ${response.status}). Try again later.`,
      );
    return await response.json();
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function requestJSON(
  url: string,
  options: RequestInit = {},
  timeout = 15000,
): Promise<unknown> {
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
    const body: unknown = await response.json();
    return body;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

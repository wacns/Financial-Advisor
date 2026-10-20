import { must } from "../guards.ts";
/** The parts of expo-secure-store this wrapper uses. */
export interface SecureStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
type Manifest = { id: string; count: number };
// SecureStore values are split below the iOS per-item warning threshold. The
// manifest changes only after all chunks are written, preserving the old value
// if writing a new session fails. No credentials are stored in AsyncStorage.
export function createSecureStorage(store: SecureStore, uuid: () => string) {
  const chunkSize = 1800;
  function split(value: string): string[] {
    const chunks: string[] = [];
    let current = "",
      bytes = 0;
    for (const character of value) {
      // A character from for...of always has a code point.
      const point = must(character.codePointAt(0), "code point"),
        size = point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
      if (bytes + size > chunkSize) {
        chunks.push(current);
        current = "";
        bytes = 0;
      }
      current += character;
      bytes += size;
    }
    if (current) chunks.push(current);
    return chunks;
  }
  const safeKey = (key: string) => `fa.${key.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  async function readManifest(key: string): Promise<Manifest | null> {
    const raw = await store.getItemAsync(safeKey(key));
    // TS-ESCAPE: manifests are only ever written by setItem below and are read back unchecked, as before.
    return raw ? JSON.parse(raw) : null;
  }
  async function clearChunks(key: string, manifest: Manifest | null) {
    if (!manifest) return;
    await Promise.allSettled(
      Array.from({ length: manifest.count }, (_, i) =>
        store.deleteItemAsync(`${safeKey(key)}.${manifest.id}.${i}`),
      ),
    );
  }
  return {
    async getItem(key: string): Promise<string | null> {
      const manifest = await readManifest(key);
      if (!manifest) return null;
      const chunks = await Promise.all(
        Array.from({ length: manifest.count }, (_, i) =>
          store.getItemAsync(`${safeKey(key)}.${manifest.id}.${i}`),
        ),
      );
      return chunks.some((chunk) => chunk === null) ? null : chunks.join("");
    },
    async setItem(key: string, value: string): Promise<void> {
      const old = await readManifest(key),
        chunks = split(value),
        manifest = { id: uuid(), count: chunks.length };
      try {
        for (let i = 0; i < manifest.count; i++)
          await store.setItemAsync(
            `${safeKey(key)}.${manifest.id}.${i}`,
            must(chunks[i], "chunk"),
          );
        await store.setItemAsync(safeKey(key), JSON.stringify(manifest));
      } catch (error) {
        await clearChunks(key, manifest);
        throw error;
      }
      await clearChunks(key, old);
    },
    async removeItem(key: string): Promise<void> {
      const old = await readManifest(key);
      await store.deleteItemAsync(safeKey(key));
      await clearChunks(key, old);
    },
  };
}

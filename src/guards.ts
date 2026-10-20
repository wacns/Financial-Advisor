// Narrows a value the code relies on being present; a missing one fails with a clear Error.
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw Error(`Missing ${what}.`);
  return value;
}
// A record assembled by a workspace command before validateWorkspace runs. Nothing is saved
// without validateWorkspace checking the whole workspace (the commands call it, and the save path
// in useWorkspace always does), so the record is typed as complete here. The key list still
// catches typos.
export function checkedLater<T>(draft: { [K in keyof T]?: unknown }): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: drafts are checked by validateWorkspace before any workspace is saved.
  return draft as T;
}
// The same membership test as options.includes(value), narrowing value to the listed options.
export const isOneOf = <T extends string>(
  options: readonly T[],
  value: unknown,
): value is T => options.some((option) => option === value);
/** A caught value's message, as error.message read it when the value was an Error. */
export const errorMessage = (error: unknown): string | undefined => {
  const message = field(error, "message");
  return typeof message === "string" ? message : undefined;
};
/** Reads value[key] the way plain property access did, without assuming value is an object. */
export const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

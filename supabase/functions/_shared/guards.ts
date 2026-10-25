// The same small guards as src/guards.ts. Edge Functions deploy only this folder, so they keep
// their own copy instead of importing from the app.

/** Reads value[key] the way plain property access did, without assuming value is an object. */
export const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

/** The same membership test as options.includes(value), narrowing value to the listed options. */
export const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  options.some((option) => option === value);

/** A pattern check on String(value), exactly as RegExp.test coerces; claims string for form values. */
export const matches = (pattern: RegExp) => (value: unknown): value is string =>
  pattern.test(String(value));

/** Narrows a value the code relies on being present; a missing one fails with a clear Error. */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw Error(`Missing ${what}.`);
  return value;
}

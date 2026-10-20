// Narrows a value the code relies on being present; a missing one fails with a clear Error.
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw Error(`Missing ${what}.`);
  return value;
}

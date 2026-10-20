// Narrows a value the code relies on being present; a missing one fails with a clear Error.
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw Error(`Missing ${what}.`);
  return value;
}
// A record assembled by a workspace command before validateWorkspace runs. Every command that
// files records ends by calling validateWorkspace on the whole workspace, which rejects any field
// this record lacks, so the record is typed as complete here. The key list still catches typos.
export function checkedLater<T>(draft: { [K in keyof T]?: unknown }): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: drafts are validated by validateWorkspace at the end of the command that files them.
  return draft as T;
}
// The same membership test as options.includes(value), narrowing value to the listed options.
export const isOneOf = <T extends string>(
  options: readonly T[],
  value: unknown,
): value is T => options.some((option) => option === value);

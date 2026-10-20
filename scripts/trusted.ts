// Release tooling reads JSON and YAML that this tooling or GitHub's API produced. It always read
// them without validating their shape; trusted() records that in one place instead of many casts.
export function trusted<T>(value: unknown): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: release tooling reads its own files and GitHub API responses unchecked, as before.
  return value as T;
}
/** Parses JSON read from a file or response this tooling trusts. */
export const trustedJson = <T>(text: string): T => trusted<T>(JSON.parse(text));

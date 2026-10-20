// Typing helpers for tests. Fixtures and fakes deliberately supply only what a test exercises,
// which the real types would reject; these two functions are the only places that says so.

/** Every field optional, at every depth, with literal types widened; functions keep their own type. */
export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends readonly (infer U)[]
          ? DeepPartial<U>[]
          : T extends object
            ? { [K in keyof T]?: DeepPartial<T[K]> }
            : T;

/** A fixture with only the fields a test needs, typed as the full shape the code under test takes. */
export function partial<T>(value: DeepPartial<T>): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: test fixtures leave out fields the code under test never reads.
  return value as T;
}

/** A hand-written test double standing in for a client, device or service. */
export function fake<T>(value: object): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: test doubles implement only the calls each test makes.
  return value as T;
}

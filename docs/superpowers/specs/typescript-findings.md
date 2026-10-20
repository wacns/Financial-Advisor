# TypeScript conversion — findings

This file lists real bugs that typing surfaced. The conversion keeps the current
behavior for each one; the owner decides on fixes separately.

| File:line | What goes wrong | Found in task |
|---|---|---|
| `src/platform/PrivacyGate.native.tsx` cover style | **Visible on phones.** React Native 0.88 removed `StyleSheet.absoluteFillObject`, so `...StyleSheet.absoluteFillObject` spreads nothing and the lock cover is laid out as an ordinary block at the top instead of covering the whole screen. App content is still hidden (`display: none`) while locked, so nothing private shows; the cover just doesn't fill the screen. The fix would be `StyleSheet.absoluteFill`. | 7 |
| `src/locale.ts` `isCivilDate` | It tests `String(value)`, so a non-string whose text is a valid date (for example the array `["2026-01-01"]`) passes, and `date()` in `src/domain/model.ts` then returns that non-string as the date. Only reachable with malformed stored or imported data. | 3 |
| `src/domain/commands.ts` `deleteCategory` | Called without an id, it adds `undefined` to `settings.hiddenCategories`; nothing validates that list. The UI always passes an id, so this is only reachable from other callers. The type now says `(string \| undefined)[]` to match. | 4 |
| `src/domain/ledger.ts` `applyEffect` | A transfer to a missing account debits the source account before it throws. Every command works on a clone and discards it on error, so users never see the half-applied state; direct callers of `saveTransaction` would. | 4 |

## Shims

## Escape hatches

## Output comparison

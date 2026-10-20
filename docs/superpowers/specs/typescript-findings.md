# TypeScript conversion — findings

This file lists real bugs that typing surfaced. The conversion keeps the current
behavior for each one; the owner decides on fixes separately.

| File:line | What goes wrong | Found in task |
|---|---|---|
| `src/locale.ts` `isCivilDate` | It tests `String(value)`, so a non-string whose text is a valid date (for example the array `["2026-01-01"]`) passes, and `date()` in `src/domain/model.ts` then returns that non-string as the date. Only reachable with malformed stored or imported data. | 3 |

## Shims

## Escape hatches

## Output comparison

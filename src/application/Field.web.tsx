import React, { useId } from "react";
import { useAppearance } from "./appearance.tsx";
import { must } from "../guards.ts";
import type { FieldModule, FieldProps } from "./fieldTypes.ts";
import type { Satisfies } from "../platform/contracts.ts";
import type * as Self from "./Field.web.tsx";
// React stringifies a controlled value itself; null and undefined leave the control uncontrolled.
const domValue = (value: unknown) => (value == null ? undefined : String(value));
export default function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  options,
  disabled = false,
  autoComplete,
}: FieldProps) {
  const id = useId();
  const { colors, t, language } = useAppearance();
  label = t(label);
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        fontSize: 13,
        fontWeight: 600,
        color: colors.ink,
        minWidth: 0,
        flex: 1,
      }}
    >
      {label}
      {type === "select" ? (
        <select
          id={id}
          aria-label={label}
          name={name}
          value={domValue(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            padding: 12,
            borderRadius: 9,
            minHeight: 44,
            background: colors.white,
            color: colors.ink,
            border: `1px solid ${colors.line}`,
          }}
        >
          {must(options, "select options").map((option) => {
            const row =
              typeof option === "string"
                ? { value: option, label: option }
                : option;
            return (
              <option key={row.value} value={row.value}>
                {t(row.label)}
              </option>
            );
          })}
        </select>
      ) : type === "textarea" ? (
        <textarea
          id={id}
          aria-label={label}
          name={name}
          value={domValue(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          style={{
            padding: 12,
            borderRadius: 9,
            width: "100%",
            boxSizing: "border-box",
            background: colors.white,
            color: colors.ink,
            border: `1px solid ${colors.line}`,
          }}
        />
      ) : (
        <input
          id={id}
          aria-label={label}
          name={name}
          value={domValue(value)}
          dir={
            type === "number" || type === "date" || type === "month"
              ? "ltr"
              : language === "ar"
                ? "rtl"
                : "ltr"
          }
          type={type}
          step={type === "number" ? "0.001" : undefined}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            minWidth: 0,
            border: `1px solid ${colors.line}`,
            borderRadius: 9,
            padding: 12,
            minHeight: 44,
            background: colors.white,
            color: colors.ink,
            fontWeight: 400,
          }}
        />
      )}
    </label>
  );
}
// Compile-time check that this module matches the Field contract.
export type FieldCheck = Satisfies<FieldModule, typeof Self>;

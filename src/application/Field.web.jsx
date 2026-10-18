import React, { useId } from "react";
export default function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  options,
  disabled = false,
  autoComplete,
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        fontSize: 13,
        fontWeight: 600,
        color: "#193b35",
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {options.map((option) => {
            const row =
              typeof option === "string"
                ? { value: option, label: option }
                : option;
            return (
              <option key={row.value} value={row.value}>
                {row.label}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          id={id}
          aria-label={label}
          name={name}
          value={value}
          type={type}
          step={type === "number" ? "0.001" : undefined}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            minWidth: 0,
            border: "1px solid #dce2df",
            borderRadius: 9,
            padding: 12,
            minHeight: 44,
            background: "white",
            color: "#193b35",
            fontWeight: 400,
          }}
        />
      )}
    </label>
  );
}

import React from "react";
import { View, TextInput, Platform } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Label, colors } from "./ui.tsx";
import { useAppearance } from "./appearance.tsx";
import { must } from "../guards.ts";
import type { FieldModule, FieldProps } from "./fieldTypes.ts";
import type { Satisfies } from "../platform/contracts.ts";
import type * as Self from "./Field.native.tsx";
export default function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  disabled = false,
  autoComplete,
}: FieldProps) {
  const { colors, t, language } = useAppearance();
  label = t(label);
  return (
    <View style={{ gap: 7, flex: 1, minWidth: 130 }}>
      <Label style={{ fontSize: 13, fontWeight: "600" }}>{label}</Label>
      {type === "select" ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 9,
            overflow: "hidden",
          }}
        >
          <Picker<unknown>
            accessibilityLabel={label}
            selectedValue={value}
            // Option values are strings, so String() changes nothing; no caller reads the index.
            onValueChange={(item) => onChange(String(item))}
            enabled={!disabled}
            style={{ color: colors.ink }}
          >
            {must(options, "select options").map((option) => {
              const row =
                typeof option === "string"
                  ? { value: option, label: option }
                  : option;
              return (
                <Picker.Item
                  key={row.value}
                  label={t(row.label)}
                  value={row.value}
                />
              );
            })}
          </Picker>
        </View>
      ) : (
        <TextInput
          accessibilityLabel={label}
          multiline={type === "textarea"}
          numberOfLines={type === "textarea" ? 8 : 1}
          value={String(value ?? "")}
          onChangeText={onChange}
          editable={!disabled}
          secureTextEntry={type === "password"}
          keyboardType={
            type === "number"
              ? Platform.OS === "ios"
                ? "numbers-and-punctuation"
                : "numeric"
              : type === "email"
                ? "email-address"
                : "default"
          }
          autoCapitalize={
            type === "email" || type === "password" ? "none" : "sentences"
          }
          autoCorrect={
            type === "password" || type === "email" ? false : undefined
          }
          autoComplete={autoComplete}
          placeholder={
            type === "date"
              ? "YYYY-MM-DD"
              : type === "month"
                ? "YYYY-MM"
                : undefined
          }
          style={{
            minHeight: 46,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 9,
            padding: 12,
            backgroundColor: colors.white,
            color: colors.ink,
            fontSize: 15,
            textAlign: language === "ar" ? "right" : "left",
          }}
        />
      )}
    </View>
  );
}
// Compile-time check that this module matches the Field contract.
export type FieldCheck = Satisfies<FieldModule, typeof Self>;

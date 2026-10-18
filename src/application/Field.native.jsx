import React from "react";
import { View, TextInput, Platform } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Label, colors } from "./ui.jsx";
export default function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  disabled = false,
  autoComplete,
}) {
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
          <Picker
            accessibilityLabel={label}
            selectedValue={value}
            onValueChange={onChange}
            enabled={!disabled}
            style={{ color: colors.ink }}
          >
            {options.map((option) => {
              const row =
                typeof option === "string"
                  ? { value: option, label: option }
                  : option;
              return (
                <Picker.Item
                  key={row.value}
                  label={row.label}
                  value={row.value}
                />
              );
            })}
          </Picker>
        </View>
      ) : (
        <TextInput
          accessibilityLabel={label}
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
            backgroundColor: "white",
            color: colors.ink,
            fontSize: 15,
          }}
        />
      )}
    </View>
  );
}

import { useAppearance } from "./appearance.tsx";
import React, { useState } from "react";
import { View, Image } from "react-native";
import { pickFile } from "../platform/files";
import { Button, Label, Muted } from "./ui.tsx";
import { errorMessage } from "../guards.ts";
export type FileFieldProps = {
  label: string;
  /** "image" limits the picker to images. */
  type?: string;
  /** The attachment as a data: URL, or "" for none. */
  value?: unknown;
  onChange: (data: string, name: string) => void;
  disabled?: boolean;
};
export default function FileField({
  label,
  type,
  value,
  onChange,
  disabled,
}: FileFieldProps) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | undefined>("");
  async function pick() {
    setBusy(true);
    setError("");
    try {
      const file = await pickFile({ image: type === "image" });
      if (file) {
        if (file.size > 1000000)
          throw Error("Attachment must be at most 1 MB.");
        onChange(file.data, file.name);
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 9 }}>
      <Label>{label}</Label>
      {typeof value === "string" && value.startsWith("data:image/") ? (
        <Image
          accessibilityLabel={label}
          source={{ uri: value }}
          style={{ width: "100%", height: 160, resizeMode: "contain" }}
        />
      ) : null}
      <Button secondary disabled={busy || disabled} onPress={pick}>
        {busy ? "Reading…" : value ? "Replace attachment" : "Choose file"}
      </Button>
      {value ? (
        <Button secondary disabled={disabled} onPress={() => onChange("", "")}>
          Remove attachment
        </Button>
      ) : null}
      {error ? <Muted accessibilityRole="alert">{error}</Muted> : null}
    </View>
  );
}

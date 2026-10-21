import { useAppearance } from "./appearance.tsx";
import React, { useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "../platform/safe-area";
import Field from "./Field";
import FileField from "./FileField.tsx";
import { Button, Heading, Muted, Label, Row, colors } from "./ui.tsx";
import { errorMessage } from "../guards.ts";
import type { FormSpec } from "./enhancementForms.ts";
export default function EntryModal({
  form,
  onClose,
  onSave,
}: {
  form: FormSpec;
  onClose: () => void;
  onSave: (
    kind: string,
    values: Record<string, unknown>,
    id: string | null | undefined,
  ) => Promise<unknown>;
}) {
  const { colors, motion, language } = useAppearance();
  const [values, setValues] = useState(form.values),
    [error, setError] = useState<string | undefined>(""),
    [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave(form.kind, values, form.id);
      onClose();
    } catch (error) {
      setError(errorMessage(error));
      setBusy(false);
    }
  }
  return (
    <Modal
      visible
      transparent
      animationType={motion ? "fade" : "none"}
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
          paddingTop: Math.max(16, insets.top),
          paddingBottom: Math.max(16, insets.bottom),
          backgroundColor: "#10291dc0",
        }}
      >
        <View
          testID="entry-dialog"
          accessibilityLabel={form.title}
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 540,
            direction: language === "ar" ? "rtl" : "ltr",
            maxHeight: "94%",
            borderRadius: 18,
            backgroundColor: colors.white,
            overflow: "hidden",
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 25, gap: 17 }}
            keyboardShouldPersistTaps="handled"
          >
            <Muted>SMALL STEPS, FORWARD</Muted>
            <Heading>{form.title}</Heading>
            {form.fields.map((field) => {
              const props = {
                ...field,
                label: field.label.replaceAll(
                  "BHD",
                  // String() is the conversion replaceAll applies to a replacement value.
                  String(
                    values.currency ||
                      (form.fields.some((f) => f.name === "accountId")
                        ? form.accounts?.find(
                            (a) =>
                              a.id ===
                              (values.accountId || form.accounts?.[0]?.id),
                          )?.currency
                        : undefined) ||
                      form.reportingCurrency ||
                      "BHD",
                  ),
                ),
                value: values[field.name],
                disabled: busy,
                // FileField passes a file name; the native picker passes an option index here.
                onChange: (value: string, fileName?: string | number) =>
                  setValues((previous) => ({
                    ...previous,
                    [field.name]: value,
                    ...(fileName ? { fileName } : {}),
                  })),
              };
              return ["image", "file"].includes(field.type)
                ? React.createElement(FileField, { key: field.name, ...props })
                : React.createElement(Field, { key: field.name, ...props });
            })}
            {form.note ? <Muted>{form.note}</Muted> : null}
            {error ? (
              <Label accessibilityRole="alert" style={{ color: colors.danger }}>
                {error}
              </Label>
            ) : null}
            <Row style={{ justifyContent: "flex-end" }}>
              <Button secondary disabled={busy} onPress={onClose}>
                Cancel
              </Button>
              <Button disabled={busy} onPress={submit}>
                {busy ? "Saving…" : form.submitLabel || "Save"}
              </Button>
            </Row>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

import { useAppearance } from "./appearance.jsx";
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
import FileField from "./FileField.jsx";
import { Button, Heading, Muted, Label, Row, colors } from "./ui.jsx";
export default function EntryModal({ form, onClose, onSave }) {
  const { colors, motion, language } = useAppearance();
  const [values, setValues] = useState(form.values),
    [error, setError] = useState(""),
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
      setError(error.message);
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
            {form.fields.map((field) =>
              React.createElement(
                ["image", "file"].includes(field.type) ? FileField : Field,
                {
                  key: field.name,
                  ...field,
                  label: field.label.replaceAll(
                    "BHD",
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
                  value: values[field.name],
                  disabled: busy,
                  onChange: (value, fileName) =>
                    setValues((previous) => ({
                      ...previous,
                      [field.name]: value,
                      ...(fileName ? { fileName } : {}),
                    })),
                },
              ),
            )}
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

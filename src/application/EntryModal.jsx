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
import { Button, Heading, Muted, Label, Row, colors } from "./ui.jsx";
export default function EntryModal({ form, onClose, onSave }) {
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
      animationType="fade"
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
            maxHeight: "94%",
            borderRadius: 18,
            backgroundColor: "white",
            overflow: "hidden",
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 25, gap: 17 }}
            keyboardShouldPersistTaps="handled"
          >
            <Muted>SMALL STEPS, FORWARD</Muted>
            <Heading>{form.title}</Heading>
            {form.fields.map((field) => (
              <Field
                key={field.name}
                {...field}
                value={values[field.name]}
                disabled={busy}
                onChange={(value) =>
                  setValues((previous) => ({
                    ...previous,
                    [field.name]: value,
                  }))
                }
              />
            ))}
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
                {busy ? "Saving…" : "Save"}
              </Button>
            </Row>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

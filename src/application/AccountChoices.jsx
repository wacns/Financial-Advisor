import React from "react";
import { Pressable } from "react-native";
import { Label, Muted, Row, Stack } from "./ui.jsx";
import { useAppearance } from "./appearance.jsx";
export function AccountChoices({
  state,
  selected,
  onChange,
  label = "Included accounts",
}) {
  const { colors } = useAppearance();
  return (
    <Stack style={{ gap: 8 }}>
      <Muted>{label} · none selected means all accounts</Muted>
      <Row>
        {state.accounts.map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="checkbox"
            accessibilityLabel={`${label}: ${a.name}`}
            accessibilityState={{ checked: selected.includes(a.id) }}
            onPress={() =>
              onChange(
                selected.includes(a.id)
                  ? selected.filter((id) => id !== a.id)
                  : [...selected, a.id],
              )
            }
            style={{
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 20,
              padding: 10,
              backgroundColor: selected.includes(a.id)
                ? colors.soft
                : colors.white,
            }}
          >
            <Label>
              {selected.includes(a.id) ? "✓ " : ""}
              {a.name}
            </Label>
          </Pressable>
        ))}
      </Row>
    </Stack>
  );
}

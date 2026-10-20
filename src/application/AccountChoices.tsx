import React from "react";
import { Pressable } from "react-native";
import { Label, Muted, Row, Stack } from "./ui.tsx";
import { useAppearance } from "./appearance.tsx";
import type { Workspace } from "../domain/types.ts";
export function AccountChoices({
  state,
  selected,
  onChange,
  label = "Included accounts",
}: {
  state: Pick<Workspace, "accounts">;
  /** Ids of the chosen accounts; none means all. */
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
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

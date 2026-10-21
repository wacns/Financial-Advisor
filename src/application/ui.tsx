import React from "react";
import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import type { StyleProp, TextProps, TextStyle, ViewStyle } from "react-native";
import {
  useAppearance,
  lightColors,
  translatedChildren,
} from "./appearance.tsx";
export const colors = lightColors;
/**
 * Renders an unchecked value exactly as React rendered it before it was typed: strings, numbers,
 * booleans and empty values as is, arrays item by item, functions as nothing, and any other
 * object fails the render the way React does.
 */
export const display = (value: unknown): ReactNode => {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  if (Array.isArray(value)) return value.map(display);
  if (typeof value === "function") return null;
  throw Error(`Objects are not valid as a React child (found: ${String(value)}).`);
};
export function Label({ children, style, ...props }: TextProps) {
  const { colors, language, t } = useAppearance();
  if (Platform.OS !== "web" && props.accessibilityRole === "status") {
    delete props.accessibilityRole;
    props.accessibilityLiveRegion = "polite";
  }
  return (
    <Text
      {...props}
      style={[
        styles.body,
        { color: colors.ink, textAlign: language === "ar" ? "right" : "left" },
        style,
      ]}
    >
      {translatedChildren(children, t)}
    </Text>
  );
}
export function Heading({
  children,
  level = 2,
  style,
}: {
  children?: ReactNode;
  level?: number;
  style?: StyleProp<TextStyle>;
}) {
  const { colors, language, t } = useAppearance();
  return (
    <Text
      accessibilityRole="header"
      {...(Platform.OS === "web" ? { "aria-level": level } : {})}
      style={[
        level === 1 ? styles.h1 : styles.h2,
        { color: colors.ink, textAlign: language === "ar" ? "right" : "left" },
        style,
      ]}
    >
      {translatedChildren(children, t)}
    </Text>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  label,
  style,
  testID,
}: {
  children?: ReactNode;
  onPress?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, t } = useAppearance();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed, hovered }) => [
        styles.button,
        secondary
          ? { backgroundColor: colors.white, borderColor: colors.line }
          : { backgroundColor: colors.primary, borderColor: colors.primary },
        (pressed || hovered) && { opacity: 0.82 },
        disabled && { opacity: 0.42 },
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary ? { color: colors.ink } : { color: "white" },
        ]}
      >
        {translatedChildren(children, t)}
      </Text>
    </Pressable>
  );
}
export function NavLink({
  children,
  onPress,
  active = false,
  href,
  style,
  label,
}: {
  children?: ReactNode;
  onPress: () => void;
  active?: boolean;
  /** Link target for the web, where the item renders as an anchor. */
  href?: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const { colors, t } = useAppearance();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t(label)}
      {...(Platform.OS === "web" ? { href } : {})}
      accessibilityState={{ selected: active }}
      onPress={(event) => {
        event.preventDefault?.();
        onPress();
      }}
      style={({ hovered }) => [
        styles.navItem,
        (active || hovered) && { backgroundColor: colors.soft },
        style,
      ]}
    >
      <Label
        style={{
          fontWeight: active ? "700" : "500",
          color: active ? colors.ink : colors.muted,
        }}
      >
        {typeof children === "string" && label
          ? children.replace(label, t(label))
          : translatedChildren(children, t)}
      </Label>
    </Pressable>
  );
}
type BoxProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
export function Card({ children, style, testID }: BoxProps) {
  const { colors, language, t } = useAppearance();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: colors.white, borderColor: colors.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({ children, style, testID }: BoxProps) {
  const { colors, language, t } = useAppearance();
  return (
    <View
      testID={testID}
      style={[
        styles.row,
        { flexDirection: language === "ar" ? "row-reverse" : "row" },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Stack({ children, style }: BoxProps) {
  return <View style={[styles.stack, style]}>{children}</View>;
}
export function Muted({ children, style, ...props }: TextProps) {
  const { colors, language, t } = useAppearance();
  return (
    <Label
      {...props}
      style={[{ color: colors.muted, fontSize: 13, lineHeight: 21 }, style]}
    >
      {children}
    </Label>
  );
}
export function Empty({
  children = "Nothing here yet. Add your first entry to get started.",
}: {
  children?: ReactNode;
}) {
  return <Muted style={{ paddingVertical: 20 }}>{children}</Muted>;
}
export function Progress({ value }: { value?: number }) {
  const { colors, language, t } = useAppearance();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.max(0, Math.min(100, Math.round(value || 0))),
      }}
      style={[styles.track, { backgroundColor: colors.soft }]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${Math.max(0, Math.min(100, value || 0))}%`,
            // A missing value compares like 0, as undefined > 100 did.
            backgroundColor: (value ?? 0) > 100 ? colors.danger : colors.accent,
          },
        ]}
      />
    </View>
  );
}
export function Stat({
  title,
  value,
  note,
  dark = false,
  testID,
}: {
  title?: ReactNode;
  value?: ReactNode;
  note?: ReactNode;
  dark?: boolean;
  testID?: string;
}) {
  const { colors, language, t } = useAppearance();
  return (
    <Card
      testID={testID}
      style={[
        { flex: 1, minWidth: 185 },
        dark && {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
      ]}
    >
      <Muted style={dark && { color: "#b7c9bd" }}>{title}</Muted>
      <Label
        style={[
          styles.number,
          { color: colors.ink },
          dark && { color: "white" },
        ]}
      >
        {value}
      </Label>
      <Muted style={dark && { color: "#c0d0c6" }}>{note}</Muted>
    </Card>
  );
}
export const styles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.ink,
    fontFamily:
      Platform.OS === "web"
        ? "Inter, system-ui, -apple-system, sans-serif"
        : undefined,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "600",
    letterSpacing: -1,
    color: colors.ink,
  },
  h2: { fontSize: 19, lineHeight: 26, fontWeight: "600", color: colors.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  stack: { gap: 18 },
  card: {
    padding: 23,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    backgroundColor: colors.white,
    gap: 12,
  },
  button: {
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 17,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primary: { backgroundColor: colors.ink, borderColor: colors.ink },
  secondary: { backgroundColor: colors.white, borderColor: colors.line },
  buttonText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  navItem: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 9 },
  number: {
    fontSize: 29,
    lineHeight: 39,
    fontWeight: "600",
    letterSpacing: -0.8,
  },
  track: {
    height: 7,
    borderRadius: 8,
    backgroundColor: colors.soft,
    overflow: "hidden",
  },
  fill: { height: 7, borderRadius: 8 },
  divider: { height: 1, backgroundColor: colors.line },
});

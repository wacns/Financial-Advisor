import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
export const colors = {
  ink: "#193b35",
  muted: "#6d7c76",
  accent: "#b87345",
  cream: "#f5f6f2",
  line: "#e2e7e1",
  soft: "#eef3ed",
  white: "#fff",
  danger: "#ad483f",
};
export function Label({ children, style, ...props }) {
  if (Platform.OS !== "web" && props.accessibilityRole === "status") {
    delete props.accessibilityRole;
    props.accessibilityLiveRegion = "polite";
  }
  return (
    <Text {...props} style={[styles.body, style]}>
      {children}
    </Text>
  );
}
export function Heading({ children, level = 2, style }) {
  return (
    <Text
      accessibilityRole="header"
      {...(Platform.OS === "web" ? { "aria-level": level } : {})}
      style={[level === 1 ? styles.h1 : styles.h2, style]}
    >
      {children}
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
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed, hovered }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
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
        {children}
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
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
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
        {children}
      </Label>
    </Pressable>
  );
}
export function Card({ children, style, testID }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}
export function Row({ children, style, testID }) {
  return (
    <View testID={testID} style={[styles.row, style]}>
      {children}
    </View>
  );
}
export function Stack({ children, style }) {
  return <View style={[styles.stack, style]}>{children}</View>;
}
export function Muted({ children, style, ...props }) {
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
}) {
  return <Muted style={{ paddingVertical: 20 }}>{children}</Muted>;
}
export function Progress({ value }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.max(0, Math.min(100, Math.round(value || 0))),
      }}
      style={styles.track}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${Math.max(0, Math.min(100, value || 0))}%`,
            backgroundColor: value > 100 ? colors.danger : colors.accent,
          },
        ]}
      />
    </View>
  );
}
export function Stat({ title, value, note, dark = false, testID }) {
  return (
    <Card
      testID={testID}
      style={[
        { flex: 1, minWidth: 185 },
        dark && { backgroundColor: colors.ink, borderColor: colors.ink },
      ]}
    >
      <Muted style={dark && { color: "#b7c9bd" }}>{title}</Muted>
      <Label style={[styles.number, dark && { color: "white" }]}>{value}</Label>
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

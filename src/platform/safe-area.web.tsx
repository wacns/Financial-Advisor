import React from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import type { SafeArea, Satisfies } from "./contracts.ts";
import type * as Self from "./safe-area.web.tsx";
export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  return children;
}
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: react-native-web passes CSS env() padding through to the page; React Native's style types only model numbers and percentages.
const insets = {
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
} as unknown as ViewStyle;
export function SafeAreaView({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Accepted for parity with the native component; the web view always pads every edge. */
  edges?: readonly ("top" | "bottom" | "left" | "right")[];
}) {
  return (
    <View
      style={[
        insets,
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function useSafeAreaInsets() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
// Compile-time check that this module matches the safe-area contract.
export type SafeAreaCheck = Satisfies<SafeArea, typeof Self>;

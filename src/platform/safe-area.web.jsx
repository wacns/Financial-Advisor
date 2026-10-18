import React from "react";
import { View } from "react-native";
export function SafeAreaProvider({ children }) {
  return children;
}
export function SafeAreaView({ children, style }) {
  return (
    <View
      style={[
        {
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        },
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

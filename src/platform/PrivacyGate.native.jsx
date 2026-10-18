import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View, Text, Pressable, StyleSheet } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { usePreventScreenCapture } from "expo-screen-capture";
export default function PrivacyGate({ children }) {
  usePreventScreenCapture("financial-advisor");
  const [unlocked, setUnlocked] = useState(false),
    [covered, setCovered] = useState(true),
    [opened, setOpened] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const working = useRef(false),
    lastAway = useRef(0),
    authorized = useRef(false);
  const unlock = useCallback(async () => {
    if (working.current || AppState.currentState !== "active") return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      if (level === LocalAuthentication.SecurityLevel.NONE) {
        authorized.current = true;
        setOpened(true);
        setUnlocked(true);
        setCovered(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock FinancialAdvisor",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
        fallbackLabel: "Use device passcode",
      });
      if (result.success) {
        authorized.current = true;
        setOpened(true);
        setUnlocked(true);
        setCovered(false);
      } else setError("Unlock with your device credentials to continue.");
    } catch {
      setError("Device authentication is unavailable. Try unlocking again.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void unlock();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        lastAway.current = lastAway.current || Date.now();
        setCovered(true);
        return;
      }
      const elapsed = lastAway.current
        ? Date.now() - lastAway.current
        : Infinity;
      lastAway.current = 0;
      if (authorized.current && elapsed < 60000) {
        setCovered(false);
        return;
      }
      authorized.current = false;
      setUnlocked(false);
      void unlock();
    });
    return () => sub.remove();
  }, [unlock]);
  return (
    <View style={{ flex: 1 }}>
      {opened ? (
        <View
          accessibilityElementsHidden={covered || !unlocked}
          importantForAccessibility={
            covered || !unlocked ? "no-hide-descendants" : "auto"
          }
          style={{ flex: 1, display: covered || !unlocked ? "none" : "flex" }}
        >
          {children}
        </View>
      ) : null}
      {covered || !unlocked ? (
        <View style={styles.cover}>
          <Text style={styles.title}>FinancialAdvisor</Text>
          <Text style={styles.text}>Your workspace is locked.</Text>
          {error ? (
            <Text accessibilityRole="alert" style={styles.text}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlock workspace"
            disabled={busy}
            onPress={unlock}
            style={styles.button}
          >
            <Text style={styles.text}>
              {busy ? "Unlocking…" : "Unlock workspace"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#193b35",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
    gap: 20,
  },
  title: { fontSize: 28, fontWeight: "700", color: "white" },
  text: { fontSize: 16, color: "white", textAlign: "center" },
  button: {
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 10,
    padding: 16,
    minHeight: 48,
  },
});

import { useAppearance } from "./appearance.jsx";
import React, { useEffect, useState } from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { Button, Card, Heading, Label, Muted, NavLink, Stack } from "./ui.jsx";
import Field from "./Field";
import * as runtime from "../platform/runtime";
import { aiOptions } from "./assistantClient.js";
export default function Login({ workspace }) {
  const { colors } = useAppearance();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  const [chatgptReady, setChatgptReady] = useState(false);
  useEffect(() => {
    let active = true;
    aiOptions()
      .then((options) => {
        if (active) setChatgptReady(options.chatgpt.signInConfigured);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const wide = useWindowDimensions().width > 800;
  async function run(action) {
    if (busy) return;
    setBusy(true);
    workspace.setMessage("");
    try {
      await action();
    } catch (error) {
      workspace.setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.cream }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.ink,
            padding: wide ? 64 : 30,
            justifyContent: "space-between",
            gap: 60,
          }}
        >
          <Label style={{ color: "white", fontSize: 23, fontWeight: "700" }}>
            ↗ FinancialAdvisor
          </Label>
          <Stack>
            <Muted style={{ color: "#b9c9b6", letterSpacing: 2 }}>
              A LITTLE INTENTION. A BRIGHTER TOMORROW.
            </Muted>
            <Heading
              level={1}
              style={{
                color: "white",
                fontSize: wide ? 56 : 36,
                lineHeight: wide ? 65 : 44,
              }}
            >
              Your money,{`\n`}at home.
            </Heading>
            <Label
              style={{
                color: "#cfdbcf",
                maxWidth: 400,
                fontSize: 17,
                lineHeight: 28,
              }}
            >
              A calmer way to see your accounts, everyday spending, and the
              plans that matter to you.
            </Label>
          </Stack>
          <Muted style={{ color: "#b9c9b6" }}>
            Made for your financial life in Bahrain · BHD
          </Muted>
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: wide ? 60 : 22,
          }}
        >
          <Stack style={{ width: "100%", maxWidth: 420 }}>
            <Muted>YOUR NEXT CHAPTER STARTS HERE</Muted>
            <Heading level={1}>Welcome to FinancialAdvisor.</Heading>
            <Muted>Sign in to your personal financial workspace.</Muted>
            <Button
              secondary
              disabled={busy || !workspace.clientConfigured}
              onPress={() => run(workspace.googleSignIn)}
            >
              Continue with Google
            </Button>
            <Button
              secondary
              disabled={busy || !chatgptReady}
              onPress={() => run(() => workspace.chatgptSignIn())}
            >
              Continue with ChatGPT
            </Button>
            {!chatgptReady ? (
              <Muted>
                ChatGPT sign-in is awaiting OpenAI approval and setup. Google
                and email are available.
              </Muted>
            ) : null}
            <Muted style={{ textAlign: "center" }}>
              OR CONTINUE WITH EMAIL
            </Muted>
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              disabled={busy}
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              disabled={busy}
            />
            <Button
              disabled={busy || !workspace.clientConfigured}
              onPress={() => run(() => workspace.authenticate(email, password))}
            >
              {busy ? "Please wait…" : "Sign in"}
            </Button>
            <Button
              secondary
              disabled={busy || !workspace.clientConfigured}
              onPress={() =>
                run(() => workspace.authenticate(email, password, true))
              }
            >
              Create an account
            </Button>
            <View nativeID="auth-message">
              <Label
                accessibilityRole="status"
                style={{ fontSize: 13, color: colors.danger }}
              >
                {workspace.message ||
                  (!workspace.clientConfigured
                    ? "Live sign-in is pending Supabase project setup. Explore the working demo below."
                    : "")}
              </Label>
            </View>
            <NavLink
              href="#/demo/overview"
              onPress={() => runtime.navigate("demo/overview")}
            >
              <Label style={{ fontWeight: "700" }}>Explore the demo ↗</Label>
            </NavLink>
            <Muted>Your space. Your pace. Your financial life.</Muted>
          </Stack>
        </View>
      </View>
    </ScrollView>
  );
}

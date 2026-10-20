import { normalizeWorkspace, validateWorkspace } from "../domain/model.ts";
import { validateCycleBudgets } from "../domain/cycles.ts";
import { validateProjects } from "../domain/projects.ts";
import { syncWidgets } from "../platform/files";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "./client.js";
import * as runtime from "../platform/runtime";
import { blankState, demoState } from "../finance.ts";
import { normalizePlanning } from "../planning.ts";
import { DEMO_STORAGE_KEY, requireBahrainWorkspace } from "../locale.ts";
import { createNotifications } from "../notifications.ts";
import { finishNativeAuth } from "../auth.ts";
import { applyEntry, togglePlan } from "./workspace.js";
import { aiOptions } from "./assistantClient.js";
export function useWorkspace() {
  const [route, setRoute] = useState(runtime.currentRoute),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true);
  // Screens can render once more while navigation is pending after sign-out.
  const [state, setState] = useState(() => normalizeWorkspace(blankState())),
    [user, setUser] = useState(null),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
  const [push, setPush] = useState({
    supported: runtime.native,
    enabled: false,
    busy: false,
  });
  const identity = useRef(null),
    stateRef = useRef(state),
    writeLock = useRef(false),
    generation = useRef(0);
  const demo = route.startsWith("demo/");
  const notifyRef = useRef(null);
  if (!notifyRef.current)
    notifyRef.current = createNotifications({
      native: runtime.native,
      platform: runtime.platform,
      preferences: runtime.preferences,
      getMessaging: runtime.getMessaging,
      client,
      getUser: () => identity.current,
      onChange: setPush,
      onNavigate: (page) => runtime.navigate(`app/${page}`),
      onMessage: setMessage,
    });
  const notifications = notifyRef.current;
  const navigate = useCallback(
    (page) => runtime.navigate(`${demo ? "demo" : "app"}/${page}`),
    [demo],
  );
  useEffect(
    () => runtime.subscribeRoutes(() => setRoute(runtime.currentRoute())),
    [],
  );
  useEffect(() => {
    let active = true;
    runtime
      .finishRedirect(client)
      .catch((error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) {
          setRoute(runtime.currentRoute());
          setReady(true);
        }
      });
    const stopActive = runtime.subscribeActive((active) => {
      if (!client) return;
      if (active) {
        client.auth.startAutoRefresh();
        if (identity.current) notifications.restore();
      } else client.auth.stopAutoRefresh();
    });
    const stopLinks = runtime.subscribeAuthLinks(async (url) => {
      try {
        await finishNativeAuth(client, url);
        runtime.navigate("app/overview");
      } catch (error) {
        if (active) setMessage(error.message);
      }
    });
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_OUT" &&
        !runtime.currentRoute().startsWith("demo/")
      ) {
        identity.current = null;
        setUser(null);
        stateRef.current = normalizeWorkspace(blankState());
        setState(stateRef.current);
        notifications.reset();
        runtime.navigate("login");
      }
    });
    return () => {
      active = false;
      stopActive();
      stopLinks();
      subscription?.data.subscription.unsubscribe();
    };
  }, [notifications]);
  useEffect(() => {
    if (!ready) return;
    const attempt = ++generation.current;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        if (route.startsWith("demo/")) {
          identity.current = null;
          setUser(null);
          notifications.reset();
          let saved;
          try {
            saved = JSON.parse(await runtime.preferences.get(DEMO_STORAGE_KEY));
          } catch {
            saved = null;
          }
          const next = normalizeWorkspace(
            requireBahrainWorkspace(saved || demoState()),
          );
          if (active && attempt === generation.current) {
            stateRef.current = next;
            setState(next);
          }
        } else if (route.startsWith("app/")) {
          if (!client) {
            runtime.navigate("login");
            return;
          }
          const verified = await client.auth.getUser();
          if (!active || attempt !== generation.current) return;
          if (verified.error || !verified.data.user) {
            identity.current = null;
            setUser(null);
            runtime.navigate("login");
            return;
          }
          const verifiedUser = verified.data.user;
          const result = await client
            .from("northline_workspaces")
            .select("data")
            .eq("user_id", verifiedUser.id)
            .maybeSingle();
          if (result.error) throw result.error;
          if (!active || attempt !== generation.current) return;
          const next = normalizeWorkspace(
            requireBahrainWorkspace(result.data?.data || blankState()),
          );
          identity.current = verifiedUser;
          setUser(verifiedUser);
          stateRef.current = next;
          setState(next);
          notifications.restore();
        } else {
          identity.current = null;
          setUser(null);
          stateRef.current = normalizeWorkspace(blankState());
          setState(stateRef.current);
        }
      } catch (error) {
        if (active) {
          setMessage(`Unable to load your workspace: ${error.message}`);
          runtime.navigate("login");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [route, ready, notifications]);
  const persist = useCallback(
    async (next) => {
      requireBahrainWorkspace(next);
      validateWorkspace(next);
      validateCycleBudgets(next);
      validateProjects(next);
      if (writeLock.current) throw Error("Please wait for the current save.");
      writeLock.current = true;
      setSaving(true);
      const attempt = generation.current,
        owner = identity.current?.id;
      try {
        if (demo)
          await runtime.preferences.set(DEMO_STORAGE_KEY, JSON.stringify(next));
        else {
          if (!client || !owner) throw Error("Sign in before saving.");
          const { error } = await client
            .from("northline_workspaces")
            .upsert({ user_id: owner, data: next }, { onConflict: "user_id" });
          if (error) throw error;
        }
        if (attempt === generation.current) {
          stateRef.current = next;
          setState(next);
        }
      } finally {
        writeLock.current = false;
        setSaving(false);
      }
    },
    [demo],
  );
  useEffect(() => {
    syncWidgets(state, !demo ? user?.id : null).catch(() => {});
  }, [state, user?.id, demo]);
  async function replace(next) {
    await persist(normalizeWorkspace(next));
    setMessage("Workspace restored. Check your balances.");
  }
  async function save(kind, data, id) {
    await persist(applyEntry(stateRef.current, kind, data, id));
    setMessage("Saved. A little step forward.");
  }
  async function toggle(kind, id) {
    try {
      await persist(togglePlan(stateRef.current, kind, id));
      setMessage("Plan updated. Your transaction history is preserved.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function authenticate(email, password, signup = false) {
    if (!client) throw Error("Live sign-in is pending Supabase setup.");
    if (!email || password.length < 8)
      throw Error("Enter your email and a password of at least 8 characters.");
    const result = signup
      ? await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: runtime.emailRedirect() },
        })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (result.data.session) runtime.navigate("app/overview");
    else
      setMessage(
        "Check your email to confirm your account. Open the confirmation link on this device.",
      );
  }
  async function signout() {
    try {
      if (!demo && client) {
        await notifications.disable();
        const { error } = await client.auth.signOut();
        if (error) throw error;
      }
      identity.current = null;
      setUser(null);
      stateRef.current = normalizeWorkspace(blankState());
      setState(stateRef.current);
      notifications.reset();
      runtime.navigate("login");
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function reset() {
    if (await runtime.confirmReset()) {
      try {
        await persist(normalizeWorkspace(demoState()));
        setMessage("Sample data restored.");
      } catch (error) {
        setMessage(error.message);
      }
    }
  }
  return {
    route,
    demo,
    state,
    user,
    loading: loading || !ready,
    saving,
    message,
    setMessage,
    push,
    notifications,
    navigate,
    save,
    toggle,
    authenticate,
    signout,
    reset,
    replace,
    clientConfigured: !!client,
    googleSignIn: () => runtime.googleSignIn(client),
    chatgptSignIn: async (link = false) => {
      const options = await aiOptions();
      return runtime.chatgptSignIn(client, options.chatgpt.signInConfigured, link);
    },
  };
}

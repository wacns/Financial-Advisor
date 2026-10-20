// The shapes each platform module exports. The .web and .native variants of a module both
// check themselves against the same contract, so the two cannot drift apart.
import type { SupabaseClient, SupabaseClientOptions } from "@supabase/supabase-js";
import type { Messaging, Preferences } from "../notifications.ts";
import type { DesktopBridge, UpdateStatus } from "./desktop-bridge.js";
export type { DesktopBridge, UpdateStatus } from "./desktop-bridge.js";

/** Fails to compile unless T fits Contract; used as `export type Check = Satisfies<Contract, typeof Self>`. */
export type Satisfies<Contract, T extends Contract> = T;

export interface Runtime {
  native: boolean;
  platform: string;
  clientConfig: { url: string; key: string };
  authOptions: NonNullable<SupabaseClientOptions<"public">["auth"]>;
  preferences: Preferences;
  currentRoute(): string;
  navigate(route: string): void;
  subscribeRoutes(callback: () => void): () => void;
  subscribeActive(callback: (active: boolean) => void): () => void;
  subscribeAuthLinks(callback: (url: string) => void): () => void;
  finishRedirect(client: SupabaseClient | null): Promise<boolean>;
  googleSignIn(client: SupabaseClient | null): Promise<void>;
  chatgptSignIn(
    client: SupabaseClient | null,
    enabled: boolean,
    link?: boolean,
  ): Promise<void>;
  emailRedirect(): string;
  getMessaging(): Promise<Messaging>;
  exportFile(content: string, type: string, name: string): Promise<void>;
  confirmReset(): Promise<boolean>;
}

declare global {
  // Present only inside the desktop app.
  var financialAdvisorDesktop: DesktopBridge | undefined;
}

/** A file the person picked, read into memory. */
export type PickedFile = {
  name: string;
  mime: string;
  /** A data: URL of the file's contents. */
  data: string;
  uri: string;
  /** The file read as text, for text formats. */
  text?: string;
  size: number;
};
/** A quick-entry link from a home screen widget. */
export type QuickEntry = {
  kind: string;
  templateId: string | null;
  owner: string | null;
};
export type CaptureRequest = NonNullable<
  ReturnType<typeof import("../domain/capture.ts").captureURL>
>;
export interface Files {
  pickFile(options?: { image?: boolean; camera?: boolean }): Promise<PickedFile | null>;
  scanReceipt(camera?: boolean): Promise<string | null>;
  downloadAttachment(data: string, name: string): Promise<void>;
  syncWidgets(
    workspace: { settings?: { widgetsEnabled?: boolean }; templates?: { id: string; name: string }[] } | null | undefined,
    owner: string | null | undefined,
  ): Promise<void>;
  subscribeQuickEntry(callback: (entry: QuickEntry) => void): () => void;
  subscribeCapture(callback: (capture: CaptureRequest) => void): () => void;
  requestWidget(): Promise<boolean>;
}

/** The app's own Expo native module (modules/financial-advisor-native). */
export interface FinancialAdvisorNative {
  recognize(uri: string): Promise<string>;
  recognizeSpeech(language: string): Promise<string>;
  stopSpeech(): Promise<void>;
  updateWidgets(json: string): Promise<void>;
  requestWidget(): Promise<boolean>;
}

export interface Speech {
  speechSupported(): boolean;
  recognizeSpeech(language?: string): Promise<string>;
  stopSpeech(): Promise<void>;
}

export interface Updates {
  updateStatus(): Promise<UpdateStatus>;
  checkUpdate(): Promise<UpdateStatus>;
  installUpdate(): Promise<void>;
  subscribeUpdates(callback: (status: UpdateStatus) => void): () => void;
}

type ChildrenOnly = { children?: import("react").ReactNode };
export interface SafeArea {
  SafeAreaProvider: import("react").ComponentType<ChildrenOnly>;
  SafeAreaView: import("react").ComponentType<
    ChildrenOnly & {
      style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
      edges?: readonly ("top" | "bottom" | "left" | "right")[];
    }
  >;
  useSafeAreaInsets(): { top: number; bottom: number; left: number; right: number };
}

export interface PrivacyGateModule {
  default: import("react").ComponentType<ChildrenOnly>;
}

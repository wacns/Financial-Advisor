import * as Updates from "expo-updates";
import type { Satisfies, UpdateStatus, Updates as UpdatesContract } from "./contracts.ts";
import type * as Self from "./updates.native.ts";
export async function updateStatus(): Promise<UpdateStatus> {
  return {
    state: Updates.isEnabled ? "idle" : "unconfigured",
    message: Updates.isEnabled
      ? "Compatible updates download on launch and apply the next time you open the app."
      : "Automatic updates are not connected in this build. Install newer app versions from your distribution provider.",
  };
}
export async function checkUpdate(): Promise<UpdateStatus> {
  if (!Updates.isEnabled) return updateStatus();
  const result = await Updates.checkForUpdateAsync();
  if (!result.isAvailable && !result.isRollBackToEmbedded) return { state: "current", message: "You have the latest compatible update." };
  await Updates.fetchUpdateAsync();
  return { state: "ready", message: "Update downloaded. Save your work before restarting." };
}
export async function installUpdate(): Promise<void> { await Updates.reloadAsync(); }
// Updates report only when asked; nothing pushes status changes on mobile.
export function subscribeUpdates(_callback: (status: UpdateStatus) => void): () => void { return () => {}; }
// Compile-time check that this module matches the updates contract.
export type UpdatesCheck = Satisfies<UpdatesContract, typeof Self>;

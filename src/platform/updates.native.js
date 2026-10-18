import * as Updates from "expo-updates";
export async function updateStatus() {
  return {
    state: Updates.isEnabled ? "idle" : "unconfigured",
    message: Updates.isEnabled
      ? "Compatible updates download on launch and apply the next time you open the app."
      : "Automatic updates are not connected in this build. Install newer app versions from your distribution provider.",
  };
}
export async function checkUpdate() {
  if (!Updates.isEnabled) return updateStatus();
  const result = await Updates.checkForUpdateAsync();
  if (!result.isAvailable && !result.isRollBackToEmbedded) return { state: "current", message: "You have the latest compatible update." };
  await Updates.fetchUpdateAsync();
  return { state: "ready", message: "Update downloaded. Save your work before restarting." };
}
export async function installUpdate() { await Updates.reloadAsync(); }
export function subscribeUpdates() { return () => {}; }

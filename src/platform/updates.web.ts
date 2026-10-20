import type { Satisfies, UpdateStatus, Updates } from "./contracts.ts";
import type * as Self from "./updates.web.ts";
const desktop = globalThis.financialAdvisorDesktop;
export async function updateStatus(): Promise<UpdateStatus> {
  return desktop ? desktop.updateStatus() : { state: "web", message: "The web app receives the latest version when you reload it." };
}
export async function checkUpdate(): Promise<UpdateStatus> { return desktop ? desktop.checkUpdate() : updateStatus(); }
export async function installUpdate(): Promise<void> { if (desktop) await desktop.installUpdate(); }
export function subscribeUpdates(callback: (status: UpdateStatus) => void): () => void { return desktop ? desktop.onUpdate(callback) : () => {}; }
// Compile-time check that this module matches the updates contract.
export type UpdatesCheck = Satisfies<Updates, typeof Self>;

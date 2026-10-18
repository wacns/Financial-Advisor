const desktop = globalThis.financialAdvisorDesktop;
export async function updateStatus() {
  return desktop ? desktop.updateStatus() : { state: "web", message: "The web app receives the latest version when you reload it." };
}
export async function checkUpdate() { return desktop ? desktop.checkUpdate() : updateStatus(); }
export async function installUpdate() { if (desktop) await desktop.installUpdate(); }
export function subscribeUpdates(callback) { return desktop ? desktop.onUpdate(callback) : () => {}; }

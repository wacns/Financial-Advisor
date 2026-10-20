// Declarations only (a .d.ts), so the desktop project can import them without compiling app code.
// The bridge the Electron preload script (desktop/preload.cts) exposes to the page as
// window.financialAdvisorDesktop. It has no imports so the desktop project can share it.

/** What the update panel shows about app updates on this platform. */
export type UpdateStatus = { state: string; message: string; version?: string };

export interface DesktopBridge {
  openAuth(url: string): Promise<unknown>;
  consumeAuthLink(): Promise<string | null | undefined>;
  onAuthLink(callback: (url: string) => void): () => void;
  updateStatus(): Promise<UpdateStatus>;
  checkUpdate(): Promise<UpdateStatus>;
  installUpdate(): Promise<unknown>;
  onUpdate(callback: (status: UpdateStatus) => void): () => void;
}

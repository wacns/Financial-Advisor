// Globals the end-to-end tests read inside the page (page.evaluate runs in the browser).
import type { DesktopBridge } from "../../src/platform/desktop-bridge.js";

declare global {
  interface Window {
    /** Must stay undefined in the desktop renderer; the smoke test checks that. */
    require?: unknown;
  }
  var financialAdvisorDesktop: DesktopBridge | undefined;
}

// Props App passes to every screen; each screen reads the ones it needs.
import type { FormContext } from "./enhancementForms.ts";
import type { WorkspaceController } from "./useWorkspace.ts";
import type { CaptureRequest } from "../platform/contracts.ts";

/** Opens the entry form for a kind of record, optionally editing record `id`. */
export type OpenForm = (
  kind: string,
  id?: string | null,
  context?: FormContext,
) => void;

export type ScreenProps = {
  workspace: WorkspaceController;
  /** The selected month, YYYY-MM. */
  month: string;
  setMonth: (month: string) => void;
  open: OpenForm;
  /** A capture link waiting to be reviewed (only passed to the capture screen). */
  capture: CaptureRequest | null;
  onCaptureConsumed: () => void;
};

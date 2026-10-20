import type { ReactNode } from "react";
import type { PrivacyGateModule, Satisfies } from "./contracts.ts";
import type * as Self from "./PrivacyGate.web.tsx";
export default function PrivacyGate({ children }: { children?: ReactNode }) {
  return children;
}
// Compile-time check that this module matches the privacy gate contract.
export type PrivacyGateCheck = Satisfies<PrivacyGateModule, typeof Self>;

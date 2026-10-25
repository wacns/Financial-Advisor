// Props shared by the web and native Field components; both variants check themselves against them.
import type { ComponentType } from "react";
import type { TextInputProps } from "react-native";
import type { FieldOption } from "./enhancementForms.ts";

export type FieldProps = {
  label: string;
  name?: string;
  /** The form's current value; forms hold whatever they were opened with. */
  value?: unknown;
  /**
   * Receives the new text, or the chosen option's value for selects. The native picker
   * also passes the option's index, as it always has (see typescript-findings.md).
   */
  onChange: (value: string, index?: number) => void;
  /** text, select, textarea, number, date, month, email or password. */
  type?: string;
  options?: readonly FieldOption[];
  disabled?: boolean;
  autoComplete?: TextInputProps["autoComplete"];
};
export interface FieldModule {
  default: ComponentType<FieldProps>;
}

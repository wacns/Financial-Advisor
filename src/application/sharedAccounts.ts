import type { SupabaseClient } from "@supabase/supabase-js";
// Rows returned by the fa_shared database function (supabase/migrations).
export type SharedAccountSummary = {
  id: string;
  name: string;
  role: string;
  archived: boolean;
  currency: string;
  balance?: unknown;
};
export type SharedTransaction = {
  id: string;
  name: string;
  type: string;
  amount: unknown;
  date: string;
  category: string;
  payee?: string;
  labels?: string[];
  note?: string;
  revision?: unknown;
};
export type SharedMember = { user_id: string; display_name: string; role: string };
export type SharedInvite = {
  id: string;
  role: string;
  redeemed?: boolean;
  expires_at: string;
};
export type CreatedInvite = { token: string; role: string; expires_at: string };
export type SharedActivity = {
  id: string;
  actor_id: string;
  action: string;
  detail?: string;
};
export type SharedSnapshot = {
  account: SharedAccountSummary;
  transactions: SharedTransaction[];
  members: SharedMember[];
  invites: SharedInvite[];
  activity: SharedActivity[];
};
/** Reads a fa_shared result as the shape that action returns. */
export function sharedResult<T>(value: unknown): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: fa_shared is this project's own database function; its results were always read without validation.
  return value as T;
}
export function sharedAccountService(client: SupabaseClient | null) {
  return {
    /** Calls the fa_shared database function; its result is unchecked here. */
    async call(action: string, values: Record<string, unknown> = {}): Promise<unknown> {
      if (!client) throw Error("Sign in to use shared accounts.");
      const { data, error } = await client.rpc("fa_shared", {
        p_action: action,
        p_data: values,
      });
      if (error)
        throw Error(
          error.code === "40001"
            ? "Someone changed this record. Refresh and review it before trying again."
            : error.message || "Unable to update the shared account.",
        );
      const result: unknown = data;
      return result;
    },
  };
}

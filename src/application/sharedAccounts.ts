import type { SupabaseClient } from "@supabase/supabase-js";
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

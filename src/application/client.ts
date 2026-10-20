import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientConfig, authOptions } from "../platform/runtime";
export const client: SupabaseClient | null =
  clientConfig.url && clientConfig.key
    ? createClient(clientConfig.url, clientConfig.key, { auth: authOptions })
    : null;

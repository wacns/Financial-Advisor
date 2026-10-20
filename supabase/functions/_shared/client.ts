import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {must} from './guards.ts';

/** A required Edge Function secret; a missing one fails clearly instead of inside createClient. */
export const secret = (name: string): string => must(Deno.env.get(name), name);
export function adminClient() {
  return createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'),
    {auth:{persistSession:false,autoRefreshToken:false}});
}
export async function authenticatedUser(admin: ReturnType<typeof adminClient>, request: Request) {
  const match = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i);
  if (!match) return null;
  const {data, error} = await admin.auth.getUser(match[1]);
  return error ? null : data.user;
}

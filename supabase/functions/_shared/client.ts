import {createClient} from 'npm:@supabase/supabase-js@2.118.0';

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {auth:{persistSession:false,autoRefreshToken:false}});
}
export async function authenticatedUser(admin: ReturnType<typeof adminClient>, request: Request) {
  const match = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i);
  if (!match) return null;
  const {data, error} = await admin.auth.getUser(match[1]);
  return error ? null : data.user;
}

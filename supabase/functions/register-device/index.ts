import {adminClient, authenticatedUser} from '../_shared/client.ts';
import {json, body, validateDevice} from '../_shared/push.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return json(request, {});
  if (request.method !== 'POST') return json(request,{error:'Method not allowed.'},405);
  const admin = adminClient();
  const user = await authenticatedUser(admin, request);
  if (!user) return json(request,{error:'Sign in first.'},401);
  let data;
  try { data = validateDevice(await body(request)); }
  catch { return json(request,{error:'Invalid device registration.'},400); }
  if (data.action === 'unregister') {
    const {error} = await admin.from('mobile_push_devices').delete().eq('installation_id',data.installationId).eq('user_id',user.id);
    return json(request,error ? {error:'Could not disconnect device.'} : {ok:true},error ? 500 : 200);
  }
  const {count, error:countError} = await admin.from('mobile_push_devices').select('*',{count:'exact',head:true}).eq('user_id',user.id).neq('installation_id',data.installationId);
  if (countError) return json(request,{error:'Could not register device.'},500);
  if ((count || 0) >= 10) return json(request,{error:'Device limit reached.'},409);
  const {error} = await admin.from('mobile_push_devices').upsert({installation_id:data.installationId,
    user_id:user.id, token:data.token, platform:data.platform, updated_at:new Date().toISOString()}, {onConflict:'installation_id'});
  return json(request,error ? {error:'Could not register device.'} : {ok:true},error ? 409 : 200);
});

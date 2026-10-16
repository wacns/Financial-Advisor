import {adminClient, authenticatedUser} from '../_shared/client.ts';
import {json, body, validateDevice, createFcmSender, deliver} from '../_shared/push.js';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return json(request,{});
  if (request.method !== 'POST') return json(request,{error:'Method not allowed.'},405);
  const admin = adminClient();
  const user = await authenticatedUser(admin,request);
  if (!user) return json(request,{error:'Sign in first.'},401);
  let input;
  try { input = await body(request); validateDevice({action:'unregister',installationId:input?.installationId}); }
  catch { return json(request,{error:'Invalid request.'},400); }
  const {data:device,error} = await admin.from('mobile_push_devices').select('*').eq('user_id',user.id).eq('installation_id',input.installationId).maybeSingle();
  if (error || !device) return json(request,{error:'Register this device first.'},404);
  try {
    const send = createFcmSender(Deno.env.get('FCM_SERVICE_ACCOUNT'));
    const minute = Math.floor(Date.now()/60000);
    const status = await deliver(admin,send,device,`test:${device.installation_id}:${minute}`,true);
    return json(request,{status},status === 'skipped' ? 429 : status === 'expired' ? 410 : 200);
  } catch { return json(request,{error:'Push delivery is not configured or the provider is unavailable.'},503); }
});

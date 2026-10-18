import {adminClient} from '../_shared/client.ts';
import {json, secretMatches, bahrainTime, hasReminderDue, createFcmSender, deliver} from '../_shared/push.js';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json(request,{error:'Method not allowed.'},405);
  if (!await secretMatches(Deno.env.get('PUSH_CRON_SECRET'),request.headers.get('x-reminder-secret')))
    return json(request,{error:'Unauthorized.'},401);
  const time = bahrainTime();
  let send;
  try { send = createFcmSender(Deno.env.get('FCM_SERVICE_ACCOUNT')); }
  catch { return json(request,{error:'Push delivery is not configured.'},503); }
  const admin = adminClient();
  let sent = 0, failed = 0;
  const cutoff = new Date(Date.now()-30*86400000).toISOString();
  // Keyset pagination remains stable if expired device tokens are removed.
  let cursor = '00000000-0000-0000-0000-000000000000';
  while (true) {
    const {data:devices,error} = await admin.from('mobile_push_devices').select('*').gt('installation_id',cursor).gte('updated_at',cutoff).order('installation_id').limit(100);
    if (error) return json(request,{error:'Could not load devices.'},500);
    if (!devices?.length) break;
    cursor = devices[devices.length-1].installation_id;
    const ids = [...new Set(devices.map(d => d.user_id))];
    const workspaces = await admin.from('northline_workspaces').select('user_id,data').in('user_id',ids);
    if (workspaces.error) return json(request,{error:'Could not load payment schedules.'},500);
    const dueUsers = new Set((workspaces.data || []).filter(w => hasReminderDue(w.data,time)).map(w => w.user_id));
    for (const device of devices.filter(d => dueUsers.has(d.user_id))) {
      try {
        const status = await deliver(admin,send,device,`reminder:${device.installation_id}:${time.date}`);
        if (status === 'sent') sent++;
      } catch { failed++; }
    }
  }
  return json(request,{sent,failed},failed ? 503 : 200);
});

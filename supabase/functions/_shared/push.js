export const productionOrigin = 'https://financial-advisor-partner.vercel.app';
const origins = new Set([productionOrigin, 'https://northline-bahrain.vercel.app',
  'capacitor://localhost', 'financialadvisor://app', 'https://localhost', 'http://localhost:5173', 'http://127.0.0.1:5173']);
export function json(request, data, status = 200) {
  const origin = request.headers.get('origin');
  return new Response(JSON.stringify(data), {status, headers:{
    'Content-Type':'application/json', 'Cache-Control':'no-store',
    ...(origins.has(origin) ? {'Access-Control-Allow-Origin':origin, Vary:'Origin'} : {}),
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
  }});
}
export async function body(request) {
  const text = await request.text();
  if (text.length > 8192) throw Error('Invalid request.');
  return JSON.parse(text);
}
export function validateDevice(data) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.installationId || ''))
    throw Error('Invalid installation.');
  if (!['register','unregister'].includes(data.action)) throw Error('Invalid action.');
  if (data.action === 'register' && (!['ios','android'].includes(data.platform) ||
    typeof data.token !== 'string' || data.token.length < 20 || data.token.length > 4096 || /\s/.test(data.token)))
    throw Error('Invalid device token.');
  return {installationId:data.installationId, action:data.action, token:data.token, platform:data.platform};
}
export function hasDuePayment(workspace, date) {
  if (workspace?.currency !== 'BHD') return false;
  return (workspace.recurring || []).some(r => !r.paused && (r.type === 'expense'||r.type==='transfer') && r.nextDue <= date) ||
    (workspace.debts || []).some(d => d.balance > 0 && d.nextDue <= date) ||
    ['subscriptions', 'installments'].some(key => (workspace[key] || []).some(plan => {
      if (plan.status !== 'active' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.firstDue)) return false;
      const paid = new Set((plan.payments || []).map(p => p.index));
      let index = 0; while (paid.has(index)) index++;
      if (key === 'installments' && index >= plan.count) return false;
      const [year,month,day] = plan.firstDue.split('-').map(Number), step = index * plan.interval;
      let due;
      if (plan.frequency === 'daily' || plan.frequency === 'weekly') due = new Date(Date.UTC(year,month-1,day+step*(plan.frequency === 'weekly' ? 7 : 1)));
      else {
        due = new Date(Date.UTC(year+(plan.frequency === 'yearly' ? step : 0),month-1+(plan.frequency === 'monthly' ? step : 0),1));
        due.setUTCDate(Math.min(day,new Date(Date.UTC(due.getUTCFullYear(),due.getUTCMonth()+1,0)).getUTCDate()));
      }
      return Number.isFinite(due.getTime()) && due.toISOString().slice(0,10) <= date;
    }));
}
export function hasReminderDue(workspace,time){
  const r={hour:9,frequency:'daily',expenses:true,salary:false,advice:false,...workspace?.settings?.reminders};
  if(time.hour<r.hour||r.frequency==='weekly'&&new Date(`${time.date}T12:00:00Z`).getUTCDay()!==0)return false;
  return r.expenses&&hasDuePayment(workspace,time.date)||r.salary&&(workspace?.recurring||[]).some(p=>!p.paused&&p.type==='income'&&p.isSalary&&p.nextDue<=time.date)||r.advice;
}
export function bahrainTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bahrain',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const value = type => parts.find(p => p.type === type).value;
  return {date:`${value('year')}-${value('month')}-${value('day')}`, hour:Number(value('hour'))};
}
export async function secretMatches(expected, supplied) {
  if (!expected || expected.length < 32 || !supplied || supplied.length > 256) return false;
  const digest = async text => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
  const [a,b] = await Promise.all([digest(expected), digest(supplied)]);
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
const encode = value => btoa(typeof value === 'string' ? value : JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');

// A service account is only read in the Edge Function, never shipped in the app.
export function createFcmSender(serviceAccount, fetcher = fetch) {
  if (!serviceAccount) throw Error('Push delivery is not configured.');
  const account = JSON.parse(serviceAccount);
  if (!/^[a-z][a-z0-9-]{4,62}$/.test(account.project_id || '') ||
      !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(account.client_email || '') ||
      typeof account.private_key !== 'string') throw Error('Push delivery is not configured.');
  let cached;
  const accessToken = async () => {
    if (cached && cached.expires > Date.now()) return cached.value;
    const now = Math.floor(Date.now()/1000);
    const payload = `${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
    const pem = account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
    const bytes = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const signed = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(payload)));
    const assertion = `${payload}.${encode(String.fromCharCode(...signed))}`;
    const response = await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
    const result = await response.json();
    if (!response.ok || !result.access_token) throw Error('Push provider authentication failed.');
    cached = {value:result.access_token, expires:Date.now() + (Math.min(Number(result.expires_in) || 3600,3600)-60)*1000};
    return cached.value;
  };
  return async (token, test = false) => {
    const credential = await accessToken();
    const response = await fetcher(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,{
      method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},
      body:JSON.stringify({message:{token,notification:{title:'FinancialAdvisor',body:test ? 'Notifications are connected on this device.' : 'Your finance reminder is ready. Open FinancialAdvisor to review your plans.'},
        data:{route:test ? 'overview' : 'bills'},android:{notification:{channel_id:'payment-reminders',icon:'ic_stat_finance'}},
        apns:{headers:{'apns-push-type':'alert','apns-priority':'10'},payload:{aps:{sound:'default'}}}}}),
    });
    const result = await response.json();
    const unregistered = result.error?.details?.some(d => d.errorCode === 'UNREGISTERED');
    if (!response.ok && !unregistered) throw Error('Push provider delivery failed.');
    return {unregistered:!!unregistered};
  };
}

export async function deliver(admin, send, device, deliveryKey, test = false) {
  const {data:claimed, error} = await admin.rpc('claim_mobile_push',{p_user_id:device.user_id,p_key:deliveryKey});
  if (error) throw Error('Could not reserve push delivery.');
  if (!claimed) return 'skipped';
  try {
    const result = await send(device.token, test);
    if (result.unregistered) await admin.from('mobile_push_devices').delete().eq('installation_id',device.installation_id).eq('token',device.token);
    const saved = await admin.from('mobile_push_deliveries').update({status:'sent',updated_at:new Date().toISOString()}).eq('user_id',device.user_id).eq('delivery_key',deliveryKey);
    if (saved.error) throw Error('Could not finalize push delivery.');
    return result.unregistered ? 'expired' : 'sent';
  } catch (error) {
    await admin.from('mobile_push_deliveries').update({status:'failed',updated_at:new Date().toISOString()}).eq('user_id',device.user_id).eq('delivery_key',deliveryKey);
    throw error;
  }
}

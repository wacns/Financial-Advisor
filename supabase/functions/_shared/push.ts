import { field, isOneOf, matches, must } from './guards.ts';
export const productionOrigin = 'https://financial-advisor-partner.vercel.app';
const origins = new Set([productionOrigin, 'https://northline-bahrain.vercel.app',
  'capacitor://localhost', 'financialadvisor://app', 'https://localhost', 'http://localhost:5173', 'http://127.0.0.1:5173']);
export function json(request: Request, data: unknown, status = 200): Response {
  const origin = request.headers.get('origin');
  return new Response(JSON.stringify(data), {status, headers:{
    'Content-Type':'application/json', 'Cache-Control':'no-store',
    ...(origin !== null && origins.has(origin) ? {'Access-Control-Allow-Origin':origin, Vary:'Origin'} : {}),
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
  }});
}
export async function body(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 8192) throw Error('Invalid request.');
  const parsed: unknown = JSON.parse(text);
  return parsed;
}
const isInstallationId = matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
export type DeviceRequest =
  | {installationId: string; action: 'register'; token: string; platform: 'ios' | 'android'}
  | {installationId: string; action: 'unregister'; token: unknown; platform: unknown};
export function validateDevice(data: unknown): DeviceRequest {
  // An empty id fails the pattern, so the value returned below is the checked one.
  const installationId = field(data, 'installationId') || '';
  if (!isInstallationId(installationId))
    throw Error('Invalid installation.');
  const action = field(data, 'action'), token = field(data, 'token'), platform = field(data, 'platform');
  if (!isOneOf(['register','unregister'], action)) throw Error('Invalid action.');
  if (action === 'register') {
    if (!isOneOf(['ios','android'], platform) ||
      typeof token !== 'string' || token.length < 20 || token.length > 4096 || /\s/.test(token))
      throw Error('Invalid device token.');
    return {installationId, action, token, platform};
  }
  return {installationId, action, token, platform};
}
// The parts of a stored workspace the reminder checks read. Stored workspaces are trusted as
// written here, as the app's own normalizeWorkspace trusts them.
type PlanLike = {
  status?: string;
  firstDue?: string;
  payments?: {index: number}[];
  count?: number;
  interval?: number;
  frequency?: string;
};
type ReminderWorkspace = {
  currency?: unknown;
  recurring?: {paused?: boolean; type?: string; nextDue?: string; isSalary?: boolean}[];
  debts?: {balance?: unknown; nextDue?: string}[];
  subscriptions?: PlanLike[];
  installments?: PlanLike[];
  settings?: {reminders?: Partial<{hour: number; frequency: string; expenses: boolean; salary: boolean; advice: boolean}>};
};
const stored = (workspace: unknown): ReminderWorkspace | null | undefined =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS-ESCAPE: stored workspaces are read as written, the same trust the app's normalizeWorkspace gives them.
  workspace as ReminderWorkspace | null | undefined;
// A missing date compares false, as \`undefined <= date\` always did.
const onOrBefore = (value: string | undefined, date: string) => value !== undefined && value <= date;
export function hasDuePayment(input: unknown, date: string): boolean {
  const workspace = stored(input);
  if (workspace?.currency !== 'BHD') return false;
  return (workspace.recurring || []).some(r => !r.paused && (r.type === 'expense'||r.type==='transfer') && onOrBefore(r.nextDue, date)) ||
    // Number() is the conversion \`balance > 0\` applied to any stored value.
    (workspace.debts || []).some(d => Number(d.balance) > 0 && onOrBefore(d.nextDue, date)) ||
    (['subscriptions', 'installments'] as const).some(key => (workspace[key] || []).some(plan => {
      if (plan.status !== 'active' || !/^\d{4}-\d{2}-\d{2}$/.test(String(plan.firstDue))) return false;
      const paid = new Set((plan.payments || []).map(p => p.index));
      let index = 0; while (paid.has(index)) index++;
      if (key === 'installments' && index >= Number(plan.count)) return false;
      // The pattern test coerces to text, so a non-text firstDue can pass it; .split then failed, and still does.
      if (typeof plan.firstDue !== 'string') throw Error('A stored plan has a first due date that is not text.');
      // A matched date always has three parts; NaN defaults match the old undefined arithmetic.
      const [year = NaN,month = NaN,day = NaN] = plan.firstDue.split('-').map(Number), step = index * Number(plan.interval);
      let due;
      if (plan.frequency === 'daily' || plan.frequency === 'weekly') due = new Date(Date.UTC(year,month-1,day+step*(plan.frequency === 'weekly' ? 7 : 1)));
      else {
        due = new Date(Date.UTC(year+(plan.frequency === 'yearly' ? step : 0),month-1+(plan.frequency === 'monthly' ? step : 0),1));
        due.setUTCDate(Math.min(day,new Date(Date.UTC(due.getUTCFullYear(),due.getUTCMonth()+1,0)).getUTCDate()));
      }
      return Number.isFinite(due.getTime()) && due.toISOString().slice(0,10) <= date;
    }));
}
export function hasReminderDue(input: unknown, time: {date: string; hour: number}): boolean {
  const workspace = stored(input);
  const r={hour:9,frequency:'daily',expenses:true,salary:false,advice:false,...workspace?.settings?.reminders};
  if(time.hour<r.hour||r.frequency==='weekly'&&new Date(`${time.date}T12:00:00Z`).getUTCDay()!==0)return false;
  return r.expenses&&hasDuePayment(workspace,time.date)||r.salary&&(workspace?.recurring||[]).some(p=>!p.paused&&p.type==='income'&&p.isSalary&&onOrBefore(p.nextDue,time.date))||r.advice;
}
export function bahrainTime(now = new Date()): {date: string; hour: number} {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bahrain',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => must(parts.find(p => p.type === type), `${type} time part`).value;
  return {date:`${value('year')}-${value('month')}-${value('day')}`, hour:Number(value('hour'))};
}
export async function secretMatches(expected: string | undefined, supplied: string | null | undefined): Promise<boolean> {
  if (!expected || expected.length < 32 || !supplied || supplied.length > 256) return false;
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
  const [a,b] = await Promise.all([digest(expected), digest(supplied)]);
  // Both digests are 32 bytes; ?? 0 matches how ^ already treats a missing byte.
  let diff = 0; for (let i=0;i<a.length;i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
const encode = (value: unknown) => btoa(typeof value === 'string' ? value : JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const isProjectId = matches(/^[a-z][a-z0-9-]{4,62}$/);
const isServiceEmail = matches(/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/);

/** Sends one push message to a device token. */
export type FcmSend = (token: string, test?: boolean) => Promise<{unregistered: boolean}>;
// A service account is only read in the Edge Function, never shipped in the app.
export function createFcmSender(serviceAccount: string | undefined, fetcher: typeof fetch = fetch): FcmSend {
  if (!serviceAccount) throw Error('Push delivery is not configured.');
  const account: unknown = JSON.parse(serviceAccount);
  const projectId = field(account, 'project_id') || '',
    clientEmail = field(account, 'client_email') || '',
    privateKey = field(account, 'private_key');
  if (!isProjectId(projectId) ||
      !isServiceEmail(clientEmail) ||
      typeof privateKey !== 'string') throw Error('Push delivery is not configured.');
  let cached: {value: unknown; expires: number} | undefined;
  const accessToken = async () => {
    if (cached && cached.expires > Date.now()) return cached.value;
    const now = Math.floor(Date.now()/1000);
    const payload = `${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:clientEmail,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
    const pem = privateKey.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
    const bytes = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const signed = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(payload)));
    const assertion = `${payload}.${encode(String.fromCharCode(...signed))}`;
    const response = await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
    const result: unknown = await response.json();
    if (!response.ok || !field(result, 'access_token')) throw Error('Push provider authentication failed.');
    cached = {value:field(result, 'access_token'), expires:Date.now() + (Math.min(Number(field(result, 'expires_in')) || 3600,3600)-60)*1000};
    return cached.value;
  };
  return async (token, test = false) => {
    const credential = await accessToken();
    const response = await fetcher(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,{
      method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},
      body:JSON.stringify({message:{token,notification:{title:'FinancialAdvisor',body:test ? 'Notifications are connected on this device.' : 'Your finance reminder is ready. Open FinancialAdvisor to review your plans.'},
        data:{route:test ? 'overview' : 'bills'},android:{notification:{channel_id:'payment-reminders',icon:'ic_stat_finance'}},
        apns:{headers:{'apns-push-type':'alert','apns-priority':'10'},payload:{aps:{sound:'default'}}}}}),
    });
    const result: unknown = await response.json();
    // The same check as result.error?.details?.some(...), read without assuming FCM's shape.
    const details = field(field(result, 'error'), 'details');
    const unregistered = Array.isArray(details) && details.some(d => field(d, 'errorCode') === 'UNREGISTERED');
    if (!response.ok && !unregistered) throw Error('Push provider delivery failed.');
    return {unregistered:!!unregistered};
  };
}

/** A stored mobile_push_devices row. */
export type PushDevice = {user_id: string; token: string; installation_id: string};
type Filter = {eq(column: string, value: unknown): Filter} & PromiseLike<{error: unknown}>;
/** The parts of the Supabase admin client delivery uses (the real client and test fakes both fit). */
export interface PushAdmin {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{data: unknown; error: unknown}>;
  from(table: string): {delete(): Filter; update(values: Record<string, unknown>): Filter};
}
export async function deliver(admin: PushAdmin, send: FcmSend, device: PushDevice, deliveryKey: string, test = false): Promise<'skipped' | 'expired' | 'sent'> {
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

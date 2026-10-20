import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDevice,hasDuePayment,hasReminderDue,bahrainTime,secretMatches,createFcmSender} from '../../supabase/functions/_shared/push.ts';
import {field,must} from '../../src/guards.ts';
import {fake} from '../support.ts';
/** The FCM message fields these tests read. */
type Payload = {message:{data:{route:string};android:{notification:{channel_id:string}};apns:{headers:Record<string,string>};notification:{body:string}}};

test('registration rejects invalid IDs, platforms and oversized tokens and discards owner fields',()=>{
  const valid={installationId:crypto.randomUUID(),action:'register',platform:'ios',token:'a'.repeat(100),userId:'forged'};
  assert.equal(field(validateDevice(valid),'userId'),undefined);
  for(const patch of [{installationId:'not-a-uuid'},{platform:'web'},{token:'short'},{token:'a'.repeat(4097)},{token:'space '.repeat(20)},{action:'send'}])
    assert.throws(()=>validateDevice({...valid,...patch}));
});
test('reminders use Bahrain time and only unpaid expense schedules or active debts',()=>{
  assert.deepEqual(bahrainTime(new Date('2026-10-31T21:00:00Z')),{date:'2026-11-01',hour:0});
  assert.deepEqual(bahrainTime(new Date('2026-10-16T06:00:00Z')),{date:'2026-10-16',hour:9});
  const workspace: {currency:string;recurring:{type:string;nextDue:string;paused?:boolean}[];debts:{balance:number;nextDue:string}[]}={currency:'BHD',recurring:[{type:'income',nextDue:'2026-10-01'},{type:'expense',nextDue:'2026-10-01',paused:true}],debts:[]};
  assert.equal(hasDuePayment(workspace,'2026-10-16'),false);
  workspace.debts=[{balance:1,nextDue:'2026-10-16'}];assert.equal(hasDuePayment(workspace,'2026-10-16'),true);
  must(workspace.debts[0],'debt').balance=0;assert.equal(hasDuePayment(workspace,'2026-10-16'),false);
  workspace.recurring.push({type:'expense',nextDue:'2026-10-17'});assert.equal(hasDuePayment(workspace,'2026-10-16'),false);
  must(workspace.recurring.at(-1),'schedule').nextDue='2026-10-15';assert.equal(hasDuePayment(workspace,'2026-10-16'),true);
  assert.equal(hasDuePayment({...workspace,currency:'USD'},'2026-10-16'),false);
});
test('scheduler authentication rejects missing, weak and incorrect secrets',async()=>{
  const secret='a'.repeat(40);
  assert.equal(await secretMatches(undefined,secret),false);
  assert.equal(await secretMatches(secret,''),false);
  assert.equal(await secretMatches('short','short'),false);
  assert.equal(await secretMatches(secret,'b'.repeat(40)),false);
  assert.equal(await secretMatches(secret,secret),true);
});
test('FCM requests use a signed server credential and generic cross-platform notification payloads',async()=>{
  const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const encoded=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
  const credentials=JSON.stringify({project_id:'fa-test-project',client_email:'fcm@fa-test-project.iam.gserviceaccount.com',private_key:`-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`});
  let authCalls=0;const payloads: Payload[]=[];
  const fetcher=fake<typeof fetch>(async(url: unknown,options: RequestInit)=>{
    if(url==='https://oauth2.googleapis.com/token'){
      // The token request body is URLSearchParams; reading it as anything else fails the test.
      const form=options.body;if(!(form instanceof URLSearchParams)) throw Error('Expected a form body');
      authCalls++;const assertion=must(form.get('assertion'),'assertion');const [header,claims,signature]=assertion.split('.');
      assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(String(signature),'base64url'),new TextEncoder().encode(`${header}.${claims}`)),true);
      assert.equal(JSON.parse(String(Buffer.from(String(claims),'base64url'))).scope,'https://www.googleapis.com/auth/firebase.messaging');
      return Response.json({access_token:'mock-server-access-token',expires_in:3600});
    }
    assert.equal(url,'https://fcm.googleapis.com/v1/projects/fa-test-project/messages:send');
    assert.equal(field(options.headers,'Authorization'),'Bearer mock-server-access-token');
    payloads.push(JSON.parse(String(options.body)));return Response.json({name:'mock-message'});
  });
  const send=createFcmSender(credentials,fetcher);await send('device-token');await send('device-token',true);
  assert.equal(authCalls,1);assert.equal(payloads[0]?.message.data.route,'bills');
  assert.equal(payloads[1]?.message.data.route,'overview');
  assert.equal(payloads[0]?.message.android.notification.channel_id,'payment-reminders');
  assert.equal(payloads[0]?.message.apns.headers['apns-push-type'],'alert');
  assert.equal(payloads[0]?.message.notification.body,'Your finance reminder is ready. Open FinancialAdvisor to review your plans.');
  assert.throws(()=>createFcmSender(undefined),/not configured/);
});

test('reminder preferences apply hour, weekly cadence and salary/advice opt-in without disclosing amounts',()=>{
 const workspace={currency:'BHD',recurring:[{type:'income',isSalary:true,nextDue:'2026-10-18'}],settings:{reminders:{hour:15,frequency:'daily',expenses:false,salary:true,advice:false}}};
 assert.equal(hasReminderDue(workspace,{date:'2026-10-18',hour:14}),false);assert.equal(hasReminderDue(workspace,{date:'2026-10-18',hour:15}),true);
 workspace.settings.reminders.salary=false;assert.equal(hasReminderDue(workspace,{date:'2026-10-18',hour:15}),false);
 workspace.settings.reminders.advice=true;workspace.settings.reminders.frequency='weekly';assert.equal(hasReminderDue(workspace,{date:'2026-10-19',hour:15}),false);assert.equal(hasReminderDue(workspace,{date:'2026-10-18',hour:15}),true);
});

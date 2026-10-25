import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNotifications, notificationRoute} from '../../src/notifications.ts';
import type {FunctionsClient, Messaging, Preferences} from '../../src/notifications.ts';
import {fake} from '../support.ts';
import {must} from '../../src/guards.ts';
type Listener = Parameters<Messaging['addListener']>[1];
type Call = {name?: string; body?: Record<string, unknown>; route?: string; message?: string};

function setup({permission='granted',native=true}={}) {
  const saved=new Map<string,string>(), events: Record<string, Listener>={}, calls: Call[]=[];let user: {id: string}|null={id:'user-a'},token='first-token',deleted=0;
  const messaging=fake<Messaging>({async addListener(name: string,listener: Listener){events[name]=listener;}, async createChannel(){},
    async requestPermissions(){return {receive:permission};},async checkPermissions(){return {receive:permission};},
    async getToken(){return {token};},async deleteToken(){deleted++;}});
  const preferences: Preferences={async get(key){return saved.get(key);},async set(key,value){saved.set(key,value);},async remove(key){saved.delete(key);}};
  const client=fake<FunctionsClient>({functions:{async invoke(name: string,{body}: {body: Record<string, unknown>}){calls.push({name,body});return {data:{ok:true}};}}});
  const controller=createNotifications({native,platform:'android',preferences,getMessaging:async()=>messaging,
    client,getUser:()=>user,onNavigate:route=>calls.push({route}),onMessage:message=>calls.push({message})});
  return {controller,saved,events,calls,messaging,client,setUser:(value: {id: string}|null)=>{user=value;},setToken:(value: string)=>{token=value;},get deleted(){return deleted;}};
}
test('push is opt-in and unavailable on the web; denied permission does not register a device',async()=>{
  const web=setup({native:false});await assert.rejects(()=>web.controller.enable(),/mobile app/);assert.equal(web.calls.length,0);
  const denied=setup({permission:'denied'});await assert.rejects(()=>denied.controller.enable(),/blocked/);
  assert.equal(denied.calls.length,0);assert.equal(denied.controller.status.enabled,false);
});
test('enable, token rotation and disable persist consent and bind no user-supplied owner ID',async()=>{
  const f=setup();await f.controller.enable();
  assert.equal(f.controller.status.enabled,true);assert.equal(f.saved.get('financial-advisor-push-v1'),'user-a');
  assert.equal(f.calls[0]?.body?.action,'register');assert.equal('userId' in must(f.calls[0]?.body, 'registration body'),false);
  const installationId=f.calls[0]?.body?.installationId;
  f.setToken('rotated-token');must(f.events.tokenReceived, 'tokenReceived listener')({token:'rotated-token'});
  await f.controller.disable();
  assert(f.calls.some(c=>c.body?.token==='rotated-token'));
  assert.deepEqual(f.calls.at(-1)?.body,{action:'unregister',installationId});
  assert.equal(f.controller.status.enabled,false);assert.equal(f.deleted,1);
  assert.equal(f.saved.has('financial-advisor-push-v1'),false);
});
test('restore never prompts or transfers remembered consent to a different user',async()=>{
  const f=setup();await f.controller.enable();
  const before=f.calls.length;f.setUser({id:'user-b'});await f.controller.restore();
  assert.equal(f.calls.length,before);
  assert.equal(f.controller.status.enabled,false);
  f.controller.reset();must(f.events.tokenReceived, 'tokenReceived listener')({token:'new-owner-token'});await f.controller.restore();
  assert.equal(f.calls.length,before);
});
test('a failed registry write revokes the generated token and does not persist opt-in',async()=>{
  const f=setup();f.client.functions.invoke=async()=>({error:Error('backend unavailable')});
  await assert.rejects(()=>f.controller.enable(),/not available/);
  assert.equal(f.controller.status.enabled,false);assert.equal(f.deleted,1);
  assert.equal(f.saved.has('financial-advisor-push-v1'),false);
});
test('Android versions without notification channels can still opt in',async()=>{
  const f=setup();f.messaging.createChannel=async()=>{throw Object.assign(Error('No channels on this OS'),{code:'UNAVAILABLE'});};
  await f.controller.enable();assert.equal(f.controller.status.enabled,true);
});
test('notification actions are restricted to known app pages and foreground copy is generic',async()=>{
  const f=setup();await f.controller.enable();
  must(f.events.notificationActionPerformed, 'notificationActionPerformed listener')({notification:{data:{route:'bills'}}});
  must(f.events.notificationActionPerformed, 'notificationActionPerformed listener')({notification:{data:{route:'https://attacker.example'}}});
  must(f.events.notificationReceived, 'notificationReceived listener')(fake<Parameters<Listener>[0]>({notification:{body:'Sensitive account balance'}}));
  assert.equal(f.calls.at(-3)?.route,'bills');assert.equal(f.calls.at(-2)?.route,'overview');
  assert.equal(f.calls.at(-1)?.message,'A FinancialAdvisor notification arrived.');
  assert.equal(notificationRoute({data:{route:'/app/settings'}}),'overview');
});

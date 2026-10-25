import test from 'node:test';
import assert from 'node:assert/strict';
import {authRedirectUrl,startGoogleSignIn,finishAuthRedirect} from '../../src/auth.ts';
import type {AuthClient,OAuthRequest} from '../../src/auth.ts';
import {fake} from '../support.ts';
const location=new URL('https://northline.example/app/?next=https://external.example/#/login');
test('Google uses a fixed same-origin callback and account selection',async()=>{
 let options: OAuthRequest|undefined;
 await startGoogleSignIn(fake<AuthClient>({auth:{signInWithOAuth:async(input: OAuthRequest)=>{options=input;return {error:null};}}}),location);
 assert.equal(authRedirectUrl(location),'https://northline.example/app/');
 assert.equal(options?.provider,'google');assert.equal(options?.options.redirectTo,'https://northline.example/app/');
 assert.equal(options?.options.queryParams?.prompt,'select_account');
});
test('PKCE code is exchanged once and removed before loading protected routes',async()=>{
 const writes: (string|undefined)[]=[];let calls=0;
 const result=await finishAuthRedirect(fake<AuthClient>({auth:{exchangeCodeForSession:async(code: string)=>{
  calls++;assert.equal(code,'test-code');assert.equal(writes[0],'/app/#/login');return {data:{session:{}},error:null};
 }}}),new URL('https://northline.example/app/?code=test-code'),{replaceState:(_: unknown,__: string,url?: string)=>writes.push(url)});
 assert.equal(result,true);assert.equal(calls,1);assert.equal(writes[1],'/app/#/app/overview');
});
test('cancelled and expired callbacks stay on sign-in without leaking provider errors',async()=>{
 for(const input of ['?error=access_denied&error_description=private-details','#error=access_denied']){
  const writes: (string|undefined)[]=[];
  await assert.rejects(()=>finishAuthRedirect(null,new URL('https://northline.example/'+input),{replaceState:(_: unknown,__: string,url?: string)=>writes.push(url)}),/cancelled/);
  assert.equal(writes[0],'/#/login');
 }
 await assert.rejects(()=>finishAuthRedirect(fake<AuthClient>({auth:{exchangeCodeForSession:async()=>({error:Error('expired'),data:{session:null}})}}),new URL('https://northline.example/?code=bad'),{replaceState(){}}),/expired/);
});
test('ordinary navigation never exchanges a code, provider errors propagate to the UI',async()=>{
 assert.equal(await finishAuthRedirect(null,location,{replaceState(){throw Error('unexpected');}}),false);
 await assert.rejects(()=>startGoogleSignIn(fake<AuthClient>({auth:{signInWithOAuth:async()=>({error:Error('Provider disabled')})}}),location),/Provider disabled/);
});

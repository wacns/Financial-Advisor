import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authRedirectUrl, startGoogleSignIn, finishNativeAuth, NATIVE_AUTH_REDIRECT} from '../../src/auth.js';

test('native Google sign-in opens the system browser with PKCE and the app callback', async () => {
  let options, opened;
  const client={auth:{signInWithOAuth:async value=>{options=value;return {data:{url:'https://example.supabase.co/auth/v1/authorize'}};}}};
  await startGoogleSignIn(client,new URL('capacitor://localhost/'),{open:async url=>{opened=url;}});
  assert.equal(options.options.skipBrowserRedirect,true);
  assert.equal(options.options.redirectTo,NATIVE_AUTH_REDIRECT);
  assert.equal(authRedirectUrl(new URL('https://localhost/'),true),NATIVE_AUTH_REDIRECT);
  assert.equal(opened,'https://example.supabase.co/auth/v1/authorize');
});
test('native callbacks accept only the exact app URL and exchange a code rather than tokens', async () => {
  const exchanged=[];
  const client={auth:{exchangeCodeForSession:async code=>{exchanged.push(code);return {data:{session:{}}};}}};
  await finishNativeAuth(client,`${NATIVE_AUTH_REDIRECT}?code=one-use-code`);
  assert.deepEqual(exchanged,['one-use-code']);
  for(const url of ['https://attacker.example/auth/callback?code=bad','com.other.app://auth/callback?code=bad','com.wacns.financialadvisor://auth/wrong?code=bad',`${NATIVE_AUTH_REDIRECT}#access_token=untrusted`])
    await assert.rejects(()=>finishNativeAuth(client,url));
  await assert.rejects(()=>finishNativeAuth(client,`${NATIVE_AUTH_REDIRECT}#error=access_denied`),/cancelled/);
  assert.deepEqual(exchanged,['one-use-code']);
});

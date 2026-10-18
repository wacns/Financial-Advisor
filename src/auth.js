// PKCE callbacks return to the app's existing document, so static hosts need no rewrite.
export const NATIVE_AUTH_REDIRECT = 'com.wacns.financialadvisor://auth/callback';
export function authRedirectUrl(location, native = false) {
  if (native) return NATIVE_AUTH_REDIRECT;
  return new URL(location.pathname, location.origin).href;
}

export async function startGoogleSignIn(client, location, nativeRuntime) {
  if (!client) throw Error('Live sign-in is pending Supabase setup.');
  const {data, error} = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: authRedirectUrl(location, !!nativeRuntime),
      ...(nativeRuntime ? {skipBrowserRedirect:true} : {}),
      queryParams: {prompt: 'select_account'},
    },
  });
  if (error) throw error;
  if (nativeRuntime) {
    if (!data?.url) throw Error('Could not open Google sign-in. Please try again.');
    await nativeRuntime.open(data.url);
  }
}

const nativeExchanges = new WeakMap();
export async function finishNativeAuth(client, callback) {
  const url = new URL(callback);
  const expected = new URL(NATIVE_AUTH_REDIRECT);
  if (url.protocol !== expected.protocol || url.hostname !== expected.hostname || url.pathname !== expected.pathname)
    throw Error('This sign-in link is not for FinancialAdvisor.');
  const error = url.searchParams.get('error') || new URLSearchParams(url.hash.slice(1)).get('error');
  if (error) throw Error(error === 'access_denied' ? 'Sign-in was cancelled. You can try again.' : 'Sign-in could not be completed. Please try again.');
  const code = url.searchParams.get('code');
  if (!code || !client) throw Error('Start sign-in again from this device.');
  // An Expo browser return and a Linking event can deliver the same URL at once.
  // Both must observe one PKCE exchange rather than racing a one-use code.
  const previous = nativeExchanges.get(client);
  if (previous?.code === code) return previous.promise;
  const promise = (async () => {
    const result = await client.auth.exchangeCodeForSession(code);
    if (result.error || !result.data.session) throw Error('This sign-in link has expired. Start sign-in again from this device.');
    return true;
  })();
  nativeExchanges.set(client, {code, promise});
  return promise;
}

export async function finishAuthRedirect(client, location, history) {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error') || hash.get('error');
  if (!code && !error) return false;
  // Consume callback parameters once, before rendering or issuing requests.
  for (const name of ['code','error','error_code','error_description']) url.searchParams.delete(name);
  url.hash = '/login';
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  if (error) throw Error(error === 'access_denied'
    ? 'Sign-in was cancelled. You can try Google again or use email and password.'
    : 'Sign-in could not be completed. Please try again.');
  if (!client) throw Error('Live sign-in is pending Supabase setup.');
  const result = await client.auth.exchangeCodeForSession(code);
  if (result.error || !result.data.session) {
    throw Error('This sign-in link has expired or could not be verified. Start sign-in again in this browser.');
  }
  // Route handling validates the user with getUser() before fetching private data.
  url.hash = '/app/overview';
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  return true;
}

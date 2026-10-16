// PKCE callbacks return to the app's existing document, so static hosts need no rewrite.
export function authRedirectUrl(location) {
  return new URL(location.pathname, location.origin).href;
}

export async function startGoogleSignIn(client, location) {
  if (!client) throw Error('Live sign-in is pending Supabase setup.');
  const {error} = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: authRedirectUrl(location),
      queryParams: {prompt: 'select_account'},
    },
  });
  if (error) throw error;
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

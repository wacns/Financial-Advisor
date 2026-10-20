import type { Provider } from "@supabase/supabase-js";
import { must } from "./guards.ts";
// PKCE callbacks return to the app's existing document, so static hosts need no rewrite.
export const NATIVE_AUTH_REDIRECT = 'com.wacns.financialadvisor://auth/callback';
type OAuthRequest = {
  provider: Provider;
  options: {
    redirectTo: string;
    skipBrowserRedirect?: boolean;
    queryParams?: Record<string, string>;
    scopes?: string;
  };
};
type OAuthResult = Promise<{ data: { url?: string | null } | null; error: unknown }>;
/** The parts of a Supabase client the sign-in flows use; the real client and test fakes both fit. */
export interface AuthClient {
  auth: {
    signInWithOAuth(request: OAuthRequest): OAuthResult;
    linkIdentity(request: OAuthRequest): OAuthResult;
    exchangeCodeForSession(
      code: string,
    ): Promise<{ data: { session: unknown }; error: unknown }>;
  };
}
/** The parts of window.location the redirect URL is built from. */
type PageLocation = { pathname: string; origin: string };
/** Opens the provider's sign-in page in the system browser on native platforms. */
export interface NativeAuthRuntime {
  open(url: string): Promise<unknown>;
}
export function authRedirectUrl(
  location: PageLocation,
  native = false,
): string {
  if (native) return NATIVE_AUTH_REDIRECT;
  return new URL(location.pathname, location.origin).href;
}

export async function startGoogleSignIn(
  client: AuthClient | null | undefined,
  location: PageLocation,
  nativeRuntime?: NativeAuthRuntime | null,
): Promise<void> {
  return startProviderSignIn(client, 'google', location, nativeRuntime);
}

export async function startChatGPTSignIn(
  client: AuthClient | null | undefined,
  location: PageLocation,
  nativeRuntime?: NativeAuthRuntime | null,
  enabled = false,
  link = false,
): Promise<void> {
  if (!enabled) throw Error('Continue with ChatGPT is awaiting OpenAI approval and provider setup.');
  return startProviderSignIn(client, 'custom:chatgpt', location, nativeRuntime, link);
}

async function startProviderSignIn(
  client: AuthClient | null | undefined,
  provider: Provider,
  location: PageLocation,
  nativeRuntime?: NativeAuthRuntime | null,
  link = false,
): Promise<void> {
  if (!client) throw Error('Live sign-in is pending Supabase setup.');
  const request: OAuthRequest = {
    provider,
    options: {
      redirectTo: authRedirectUrl(location, !!nativeRuntime),
      ...(nativeRuntime ? {skipBrowserRedirect:true} : {}),
      ...(provider === 'google' ? { queryParams: {prompt: 'select_account'} } : { scopes: 'openid profile email' }),
    },
  };
  const {data, error} = await (link
    ? client.auth.linkIdentity(request)
    : client.auth.signInWithOAuth(request));
  if (error) throw error;
  if (nativeRuntime) {
    if (!data?.url) throw Error('Could not open sign-in. Please try again.');
    await nativeRuntime.open(data.url);
  }
}

const nativeExchanges = new WeakMap<AuthClient, {code: string; promise: Promise<boolean>}>();
export async function finishNativeAuth(
  client: AuthClient | null | undefined,
  callback: string,
): Promise<boolean> {
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

export async function finishAuthRedirect(
  client: AuthClient | null | undefined,
  location: { href: string },
  history: { replaceState(data: unknown, unused: string, url?: string): void },
): Promise<boolean> {
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
  // Without an error the early return above guarantees a code.
  const result = await client.auth.exchangeCodeForSession(must(code, 'sign-in code'));
  if (result.error || !result.data.session) {
    throw Error('This sign-in link has expired or could not be verified. Start sign-in again in this browser.');
  }
  // Route handling validates the user with getUser() before fetching private data.
  url.hash = '/app/overview';
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  return true;
}

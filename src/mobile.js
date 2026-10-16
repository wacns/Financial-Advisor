import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
export const NATIVE_AUTH_URL = 'com.wacns.financialadvisor://auth/callback';

// Auth sessions and PKCE verifiers use Keychain/Android Keystore on devices.
// Web keeps Supabase's existing storage behavior.
export const nativeAuthStorage = isNative ? Object.fromEntries(
  ['getItem', 'setItem', 'removeItem'].map(method => [method, async (...args) => {
    const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
    return SecureStorage[method](...args);
  }]),
) : undefined;

export const nativePreferences = {
  async get(key) { return (await Preferences.get({key})).value; },
  async set(key, value) { await Preferences.set({key, value}); },
  async remove(key) { await Preferences.remove({key}); },
};

export async function openNativeAuth(url) {
  const target = new URL(url);
  if (target.protocol !== 'https:') throw Error('The sign-in address must use HTTPS.');
  await Browser.open({url: target.href});
}

export async function initializeNative({onAuthUrl, onBack, onActive}) {
  if (!isNative) return;
  document.documentElement.classList.add('native-app');
  let lastAuthUrl;
  const receive = async ({url}) => {
    const target = new URL(url);
    const expected = new URL(NATIVE_AUTH_URL);
    if (target.protocol !== expected.protocol || target.hostname !== expected.hostname ||
        target.pathname !== expected.pathname || url === lastAuthUrl) return;
    lastAuthUrl = url;
    try { await Browser.close(); } catch { /* Android closes the custom tab itself. */ }
    await onAuthUrl(url);
  };
  await App.addListener('appUrlOpen', event => { receive(event).catch(() => {}); });
  await App.addListener('appStateChange', ({isActive}) => onActive(isActive));
  await App.addListener('backButton', ({canGoBack}) => onBack(canGoBack, () => App.exitApp()));
  const launch = await App.getLaunchUrl();
  if (launch?.url) await receive(launch);
  onActive(true);
}

export async function nativeMessaging() {
  if (!isNative) return null;
  return (await import('@capacitor-firebase/messaging')).FirebaseMessaging;
}

export async function shareNativeExport(content, filename) {
  const [{Filesystem, Directory, Encoding}, {Share}] = await Promise.all([
    import('@capacitor/filesystem'), import('@capacitor/share'),
  ]);
  const {uri} = await Filesystem.writeFile({path:`exports/${filename}`,data:content,
    directory:Directory.Cache,encoding:Encoding.UTF8,recursive:true});
  await Share.share({url:uri,title:filename,dialogTitle:'Export from FinancialAdvisor'});
}

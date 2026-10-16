import {existsSync, readFileSync} from 'node:fs';
import {loadEnv} from 'vite';

const env = {...loadEnv('native',process.cwd(),'VITE_'),...process.env};
const configured = ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'].every(key=>!!env[key]);
if (!configured) {
  console.error('Native builds need the public Supabase URL and publishable key. Set them in .env.native.local or your build environment. Never use a service-role key.');
  process.exit(1);
}
if (!env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
  console.error('Use a Supabase publishable key in the native client.');
  process.exit(1);
}
const {appId} = JSON.parse(readFileSync('capacitor.config.json','utf8'));
const firebase = 'android/app/google-services.json';
if (existsSync(firebase)) {
  const config = JSON.parse(readFileSync(firebase,'utf8'));
  if (!config.client?.some(client=>client.client_info?.android_client_info?.package_name===appId)) {
    console.error('The Android Firebase app package does not match capacitor.config.json.');
    process.exit(1);
  }
}
console.log(`Native client configuration ready for ${appId}.`);
console.log(`Firebase files: Android ${existsSync(firebase) ? 'present' : 'not configured'}, iOS ${existsSync('ios/App/App/GoogleService-Info.plist') ? 'present' : 'not configured'}.`);

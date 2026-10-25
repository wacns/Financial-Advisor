import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'oauth.spec.*',
 use:{baseURL:'http://127.0.0.1:5174',launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}:{}},
 webServer:{command:'npm run dev -- --port 5174',url:'http://127.0.0.1:5174',reuseExistingServer:false,env:{VITE_SUPABASE_URL:'https://northline-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only'}}
});

import {test,expect} from '@playwright/test';
const origin='http://127.0.0.1:5174';
const user={id:'11111111-1111-4111-8111-111111111111',email:'fatima@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'google'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
function token(){const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');return `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.test-signature`;}
test('Google PKCE redirect, callback, verified workspace, and sign-out with mocked Supabase',async({page})=>{
 let authorize,exchanges=0,userChecks=0,workspaceReads=0;
 await page.route('https://northline-test.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname.endsWith('/authorize')){authorize=url;return route.fulfill({contentType:'text/html',body:'<p>Mock Google consent</p>'});}
  if(url.pathname.endsWith('/token')){exchanges++;const data=request.postDataJSON();expect(url.searchParams.get('grant_type')).toBe('pkce');expect(data.auth_code).toBe('mock-google-code');expect(data.code_verifier.length).toBeGreaterThan(20);return route.fulfill({json:{access_token:token(),refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user}});}
  if(url.pathname.endsWith('/user')){userChecks++;return route.fulfill({json:user});}
  if(url.pathname.startsWith('/rest/v1/')){workspaceReads++;expect(userChecks).toBeGreaterThan(0);expect(url.searchParams.get('user_id')).toBe(`eq.${user.id}`);return route.fulfill({json:{data:{currency:'BHD',accounts:[],transactions:[],budgets:[],goals:[]}}});}
  if(url.pathname.endsWith('/logout'))return route.fulfill({status:204});
  throw Error(`Unexpected Supabase endpoint: ${url.pathname}`);
 });
 await page.goto('/#/login');
 await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
 await expect(page.getByText('Mock Google consent')).toBeVisible();
 expect(authorize.searchParams.get('provider')).toBe('google');
 expect(authorize.searchParams.get('redirect_to')).toBe(`${origin}/`);
 expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');
 expect(authorize.searchParams.get('code_challenge').length).toBeGreaterThan(20);
 await page.goto('/?code=mock-google-code');
 await expect(page.getByRole('heading',{name:'A clearer picture.'})).toBeVisible();
 await expect(page).toHaveURL(`${origin}/#/app/overview`);
 expect(exchanges).toBe(1);expect(workspaceReads).toBe(1);
 await page.getByRole('link',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Welcome to Northline.'})).toBeVisible();
});
test('denied and expired OAuth callbacks display recoverable errors',async({page})=>{
 await page.goto('/?error=access_denied&error_description=sensitive-provider-detail');
 await expect(page.locator('#auth-message')).toContainText('cancelled');
 await expect(page).toHaveURL(`${origin}/#/login`);
 await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeEnabled();
 await page.goto('/?code=expired-code');
 await expect(page.locator('#auth-message')).toContainText('expired');
 await expect(page).toHaveURL(`${origin}/#/login`);
});

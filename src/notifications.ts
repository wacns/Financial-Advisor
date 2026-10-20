import { field, must } from './guards.ts';
const preferenceKey = 'financial-advisor-push-v1';
const installationKey = 'financial-advisor-installation-v1';
const routes = new Set(['overview', 'transactions', 'calendar', 'bills', 'goals', 'subscriptions', 'installments']);

export type NotificationLike = { data?: { route?: unknown } | null } | null | undefined;
export function notificationRoute(notification: NotificationLike): string {
  const route = notification?.data?.route;
  return typeof route === 'string' && routes.has(route) ? route : 'overview';
}

export type NotificationStatus = {
  supported: boolean;
  enabled: boolean;
  permission: string;
  busy: boolean;
  error?: string | null;
};
/** The push-messaging bridge each platform provides. */
export interface Messaging {
  /** Events: tokenReceived ({token}), notificationActionPerformed ({notification}), notificationReceived. */
  addListener(
    event: 'tokenReceived' | 'notificationActionPerformed' | 'notificationReceived',
    listener: (event: {token?: string; notification?: NotificationLike}) => void,
  ): unknown;
  createChannel(channel: {id: string; name: string; importance: number; visibility: number}): Promise<unknown>;
  getToken(): Promise<{token: string}>;
  requestPermissions(): Promise<{receive: string}>;
  checkPermissions(): Promise<{receive: string}>;
  deleteToken(): Promise<unknown>;
}
/** Small persistent key-value storage on the device. */
export interface Preferences {
  get(key: string): Promise<string | null | undefined>;
  set(key: string, value: string): Promise<unknown>;
  remove(key: string): Promise<unknown>;
}
type FunctionResult = {data?: {error?: unknown; status?: unknown} | null; error?: unknown};
/** The part of a Supabase client that calls Edge Functions. */
export interface FunctionsClient {
  functions: {invoke(name: string, options: {body: Record<string, unknown>}): Promise<FunctionResult>};
}
export type NotificationDependencies = {
  native: boolean;
  platform: string;
  preferences: Preferences;
  getMessaging: () => Promise<Messaging>;
  client: FunctionsClient | null | undefined;
  getUser: () => {id: string} | null | undefined;
  onChange?: (status: NotificationStatus) => void;
  onNavigate?: (route: string) => void;
  onMessage?: (message: string) => void;
};

// Dependencies are injected so permission, token rotation and account changes
// can be exercised without a device or a real notification provider.
export function createNotifications({native, platform, preferences, getMessaging, client,
  getUser, onChange = () => {}, onNavigate = () => {}, onMessage = () => {}}: NotificationDependencies) {
  let status: NotificationStatus = {supported: native, enabled: false, permission: 'prompt', busy: false};
  let messaging: Messaging | undefined,
    installationId: string | null | undefined,
    ownerId: string | null | undefined,
    initialized = false;
  let operation: Promise<unknown> = Promise.resolve();
  const update = (patch: Partial<NotificationStatus>) => { status = {...status, ...patch}; onChange(status); };
  // setup() always assigns messaging before anything below uses it.
  const bridge = () => must(messaging, 'messaging bridge');
  const serialized = <T>(task: () => Promise<T>): Promise<T> => {
    const next = operation.then(task, task);
    operation = next.catch(() => {});
    return next;
  };
  const invoke = async (body: Record<string, unknown>) => {
    if (!client || !getUser()) throw Error('Sign in to enable notifications.');
    const {data, error} = await client.functions.invoke('register-device', {body});
    if (error || data?.error) throw Error('Notifications could not be saved. Please try again.');
  };
  const setup = async () => {
    if (initialized) return;
    const bridge = (messaging = await getMessaging());
    installationId = await preferences.get(installationKey);
    if (!installationId) {
      installationId = crypto.randomUUID();
      await preferences.set(installationKey, installationId);
    }
    await bridge.addListener('tokenReceived', ({token}) => {
      serialized(async () => {
        if (!status.enabled || getUser()?.id !== ownerId) return;
        await invoke({action: 'register', token, platform, installationId});
      }).catch(() => update({error: 'Open Notifications and try enabling again to reconnect this device.'}));
    });
    await bridge.addListener('notificationActionPerformed', ({notification}) => onNavigate(notificationRoute(notification)));
    await bridge.addListener('notificationReceived', () => onMessage('A FinancialAdvisor notification arrived.'));
    if (platform === 'android') {
      try { await bridge.createChannel({id:'payment-reminders', name:'Payment reminders', importance:3, visibility:0}); }
      catch (error) { if (field(error, 'code') !== 'UNAVAILABLE') throw error; } // Android 7 has no channels.
    }
    initialized = true;
  };
  const bind = async () => {
    const userId = getUser()?.id;
    if (!userId) throw Error('Sign in to enable notifications.');
    const {token} = await bridge().getToken();
    if (getUser()?.id !== userId) throw Error('Your account changed. Please try again.');
    await invoke({action:'register', token, platform, installationId});
    ownerId = userId;
    await preferences.set(preferenceKey, userId);
    update({enabled:true, error:null});
  };
  return {
    get status() { return status; },
    enable: () => serialized(async () => {
      if (!native || !getUser()) throw Error('Open the mobile app and sign in to enable notifications.');
      update({busy:true, error:null});
      try {
        await setup();
        const {receive} = await bridge().requestPermissions();
        update({permission:receive});
        if (receive !== 'granted') throw Error('Notifications are blocked. Allow them in your device settings.');
        await bind();
      } catch (error) {
        // Do not leave a generated token active when backend registration fails.
        if (!status.enabled) await messaging?.deleteToken().catch(() => {});
        const reason = field(error, 'message');
        const message = typeof reason === 'string' && reason.startsWith('Notifications are blocked.') ? reason : 'Notifications are not available yet. Please try again later.';
        update({error:message});
        throw Error(message);
      } finally { update({busy:false}); }
    }),
    restore: () => serialized(async () => {
      const userId = getUser()?.id;
      if (!native || !userId) return;
      try {
        const remembered = await preferences.get(preferenceKey);
        if (getUser()?.id !== userId) return;
        if (remembered !== userId) { ownerId = null; update({enabled:false}); return; }
        await setup();
        const {receive} = await bridge().checkPermissions();
        update({permission:receive});
        if (receive !== 'granted') {
          await invoke({action:'unregister', installationId});
          await preferences.remove(preferenceKey);
          update({enabled:false});
          return;
        }
        await bind();
      } catch { update({error:'Notifications need to reconnect. Try enabling them again.'}); }
    }),
    disable: () => serialized(async () => {
      if (!native) return;
      update({busy:true});
      try {
        if (!installationId) installationId = await preferences.get(installationKey);
        const tasks: Promise<unknown>[] = [];
        if (installationId && getUser()) tasks.push(invoke({action:'unregister', installationId}));
        if (messaging) tasks.push(messaging.deleteToken());
        const outcomes = await Promise.allSettled(tasks);
        if (outcomes.length && outcomes.every(result => result.status === 'rejected')) throw Error('Could not disconnect notifications. Please try again.');
        await preferences.remove(preferenceKey);
        ownerId = null;
        update({enabled:false, error:null});
      } finally { update({busy:false}); }
    }),
    async test() {
      if (!native || !status.enabled || getUser()?.id !== ownerId) throw Error('Enable notifications on this device first.');
      const {data, error} = await must(client, 'Supabase client').functions.invoke('send-push', {body:{installationId}});
      if (error || data?.error || data?.status !== 'sent') throw Error('A test notification could not be sent. Please try again later.');
      return data;
    },
    // Called after credentials are cleared: prevent token events rebinding an old user.
    reset() { ownerId = null; update({enabled:false, busy:false}); },
  };
}

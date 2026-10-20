const preferenceKey = 'financial-advisor-push-v1';
const installationKey = 'financial-advisor-installation-v1';
const routes = new Set(['overview', 'transactions', 'calendar', 'bills', 'goals', 'subscriptions', 'installments']);

export function notificationRoute(notification) {
  const route = notification?.data?.route;
  return routes.has(route) ? route : 'overview';
}

// Dependencies are injected so permission, token rotation and account changes
// can be exercised without a device or a real notification provider.
export function createNotifications({native, platform, preferences, getMessaging, client,
  getUser, onChange = () => {}, onNavigate = () => {}, onMessage = () => {}}) {
  let status = {supported: native, enabled: false, permission: 'prompt', busy: false};
  let messaging, installationId, ownerId, initialized = false;
  let operation = Promise.resolve();
  const update = patch => { status = {...status, ...patch}; onChange(status); };
  const serialized = task => {
    const next = operation.then(task, task);
    operation = next.catch(() => {});
    return next;
  };
  const invoke = async body => {
    if (!client || !getUser()) throw Error('Sign in to enable notifications.');
    const {data, error} = await client.functions.invoke('register-device', {body});
    if (error || data?.error) throw Error('Notifications could not be saved. Please try again.');
  };
  const setup = async () => {
    if (initialized) return;
    messaging = await getMessaging();
    installationId = await preferences.get(installationKey);
    if (!installationId) {
      installationId = crypto.randomUUID();
      await preferences.set(installationKey, installationId);
    }
    await messaging.addListener('tokenReceived', ({token}) => {
      serialized(async () => {
        if (!status.enabled || getUser()?.id !== ownerId) return;
        await invoke({action: 'register', token, platform, installationId});
      }).catch(() => update({error: 'Open Notifications and try enabling again to reconnect this device.'}));
    });
    await messaging.addListener('notificationActionPerformed', ({notification}) => onNavigate(notificationRoute(notification)));
    await messaging.addListener('notificationReceived', () => onMessage('A FinancialAdvisor notification arrived.'));
    if (platform === 'android') {
      try { await messaging.createChannel({id:'payment-reminders', name:'Payment reminders', importance:3, visibility:0}); }
      catch (error) { if (error.code !== 'UNAVAILABLE') throw error; } // Android 7 has no channels.
    }
    initialized = true;
  };
  const bind = async () => {
    const userId = getUser()?.id;
    if (!userId) throw Error('Sign in to enable notifications.');
    const {token} = await messaging.getToken();
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
        const {receive} = await messaging.requestPermissions();
        update({permission:receive});
        if (receive !== 'granted') throw Error('Notifications are blocked. Allow them in your device settings.');
        await bind();
      } catch (error) {
        // Do not leave a generated token active when backend registration fails.
        if (!status.enabled) await messaging?.deleteToken().catch(() => {});
        const message = error.message.startsWith('Notifications are blocked.') ? error.message : 'Notifications are not available yet. Please try again later.';
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
        const {receive} = await messaging.checkPermissions();
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
        const tasks = [];
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
      const {data, error} = await client.functions.invoke('send-push', {body:{installationId}});
      if (error || data?.error || data?.status !== 'sent') throw Error('A test notification could not be sent. Please try again later.');
      return data;
    },
    // Called after credentials are cleared: prevent token events rebinding an old user.
    reset() { ownerId = null; update({enabled:false, busy:false}); },
  };
}

-- Run manually only AFTER FCM_SERVICE_ACCOUNT and PUSH_CRON_SECRET are configured
-- and a physical device test succeeds. Enable pg_cron/pg_net/Vault first.
-- Store the same cron secret in Vault as financial_advisor_push_cron_secret.
-- Never paste the actual secret into this versioned file.
do $$ begin
  if not exists(select 1 from vault.secrets where name = 'financial_advisor_push_cron_secret') then
    raise exception 'Add financial_advisor_push_cron_secret to Supabase Vault first';
  end if;
end $$;

select cron.schedule(
  'financial-advisor-payment-reminders',
  '0 * * * *',
  $job$
    select net.http_post(
      url := 'https://srwzgwodlpylezdaipce.supabase.co/functions/v1/dispatch-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'financial_advisor_push_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $job$
);

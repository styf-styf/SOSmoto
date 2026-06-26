-- Soporte para cobro de suscripciones vía Payphone (botón de pago por redirección)
alter table payments add column client_transaction_id text;
alter table payments add column plan_id uuid references subscription_plans(id);
create unique index idx_payments_client_transaction_id on payments(client_transaction_id);

-- Para no repetir el recordatorio de vencimiento cada día
alter table business_subscriptions add column reminder_sent_at timestamptz;
create index idx_business_subscriptions_status_expires on business_subscriptions(status, expires_at);

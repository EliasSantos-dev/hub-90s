-- Prevent double-claim: Saipos order IDs reset daily,
-- so the dedup key includes cod_store + order_id + YYYY-MM-DD.
ALTER TABLE fichas ADD CONSTRAINT fichas_ref_id_unique UNIQUE (ref_id);

-- Audit log for incoming Saipos webhook events
-- No auto-credit from webhooks (no phone in payload), just logging.
CREATE TABLE IF NOT EXISTS saipos_webhook_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event       text NOT NULL,
  cod_store   text NOT NULL,
  order_id    text NOT NULL,
  raw_payload jsonb NOT NULL,
  received_at timestamptz DEFAULT now()
);

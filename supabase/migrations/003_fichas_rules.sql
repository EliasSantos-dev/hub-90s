-- Admin-configurable: how many fichas a given order earns
CREATE TABLE IF NOT EXISTS fichas_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_store     text NOT NULL DEFAULT '*',
  min_value     numeric NOT NULL DEFAULT 0,
  fichas_amount int NOT NULL DEFAULT 3,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Default rule: any order gives 3 fichas
INSERT INTO fichas_rules (cod_store, min_value, fichas_amount, active)
VALUES ('*', 0, 3, true)
ON CONFLICT DO NOTHING;

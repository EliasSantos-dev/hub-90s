-- supabase/migrations/004_recharge.sql

-- 1. Coluna de recharge em players
--    DEFAULT now() - interval '24 hours' para que players existentes possam recarregar na primeira abertura
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS fichas_recharged_at timestamptz
  DEFAULT (now() - interval '24 hours');

-- 2. RLS: players podem inserir suas próprias fichas (necessário para fichas welcome no cadastro)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fichas' AND policyname = 'fichas_self_insert'
  ) THEN
    CREATE POLICY "fichas_self_insert" ON fichas
      FOR INSERT WITH CHECK (player_id = auth.uid());
  END IF;
END $$;

-- 3. RPC: recarrega fichas passivas (máx 3, +1 a cada 24h)
CREATE OR REPLACE FUNCTION recharge_fichas(p_player_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance    int;
  v_recharged  timestamptz;
  v_hours      float;
  v_to_add     int;
BEGIN
  IF p_player_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM fichas WHERE player_id = p_player_id;

  IF v_balance >= 3 THEN
    RETURN v_balance;
  END IF;

  SELECT fichas_recharged_at INTO v_recharged
  FROM players WHERE id = p_player_id;

  v_hours  := EXTRACT(EPOCH FROM (now() - v_recharged)) / 3600;
  v_to_add := LEAST(3 - v_balance, FLOOR(v_hours / 24)::int);

  IF v_to_add > 0 THEN
    INSERT INTO fichas (player_id, amount, reason)
    SELECT p_player_id, 1, 'recharge_diario'
    FROM generate_series(1, v_to_add);

    UPDATE players SET fichas_recharged_at = now()
    WHERE id = p_player_id;
  END IF;

  RETURN v_balance + v_to_add;
END;
$$;

-- 4. RPC: debita fichas atomicamente (verifica saldo + insere em uma transação)
CREATE OR REPLACE FUNCTION debit_ficha(p_player_id uuid, p_amount int, p_reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance int;
BEGIN
  IF p_player_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM fichas WHERE player_id = p_player_id;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_fichas';
  END IF;

  INSERT INTO fichas (player_id, amount, reason)
  VALUES (p_player_id, -p_amount, p_reason);

  RETURN v_balance - p_amount;
END;
$$;

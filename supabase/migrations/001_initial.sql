-- Tabela de jogadores (leads)
CREATE TABLE IF NOT EXISTS players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname    text UNIQUE NOT NULL,
  phone       text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Tabela de jogos
CREATE TABLE IF NOT EXISTS games (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  active          boolean DEFAULT false,
  top_n_discount  int DEFAULT 3,
  discount_pct    int DEFAULT 10,
  season          int DEFAULT 1
);

-- Tabela de pontuações
CREATE TABLE IF NOT EXISTS scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid REFERENCES players(id) ON DELETE CASCADE,
  game_id     uuid REFERENCES games(id) ON DELETE CASCADE,
  score       int NOT NULL,
  wave        int,
  season      int NOT NULL DEFAULT 1,
  created_at  timestamptz DEFAULT now()
);

-- Tabela de fichas (créditos/débitos)
CREATE TABLE IF NOT EXISTS fichas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid REFERENCES players(id) ON DELETE CASCADE,
  amount      int NOT NULL,
  reason      text,
  ref_id      text,
  created_at  timestamptz DEFAULT now()
);

-- View: melhor score por player por temporada ativa
CREATE OR REPLACE VIEW ranking AS
  WITH best AS (
    SELECT s.game_id, s.player_id, MAX(s.score) AS score
    FROM scores s
    JOIN games g ON g.id = s.game_id
    WHERE s.season = g.season
    GROUP BY s.game_id, s.player_id
  )
  SELECT
    game_id,
    player_id,
    score,
    RANK() OVER (PARTITION BY game_id ORDER BY score DESC) AS position
  FROM best;

-- View: descontos ativos
CREATE OR REPLACE VIEW active_discounts AS
  SELECT r.player_id, r.game_id, g.discount_pct
  FROM ranking r
  JOIN games g ON g.id = r.game_id
  WHERE r.position <= g.top_n_discount
    AND g.active = true;

-- Seed: jogo Burger Invaders
INSERT INTO games (name, slug, active, top_n_discount, discount_pct, season)
VALUES ('Burger Invaders', 'burger-invaders', true, 3, 10, 1)
ON CONFLICT (slug) DO NOTHING;

-- RLS: habilitar
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policies: leitura pública de games
CREATE POLICY "games_public_read" ON games FOR SELECT USING (true);

-- Policies: jogador vê e insere seus próprios dados
CREATE POLICY "players_self" ON players FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "scores_self_insert" ON scores FOR INSERT
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "scores_public_read" ON scores FOR SELECT USING (true);

CREATE POLICY "fichas_self_read" ON fichas FOR SELECT
  USING (player_id = auth.uid());

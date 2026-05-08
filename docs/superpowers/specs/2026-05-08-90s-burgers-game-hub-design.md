# 90s Burgers Game Hub — Design Spec

**Data:** 2026-05-08
**Autor:** Elias Santos
**Status:** Aprovado

---

## Visão Geral

Ecossistema de games web para a lanchonete 90s Burgers N' Fries (Garanhuns/PE). Clientes jogam jogos temáticos anos 90, sobem no ranking e ganham descontos vitalícios enquanto estiverem no top. Pedidos feitos via Saipos convertem em fichas que alimentam o loop de jogo.

**Objetivo de negócio:** captura de leads qualificados, viralidade orgânica via compartilhamento de score, fidelização via ranking competitivo e aumento de pedidos pelo loop fichas ↔ delivery.

---

## Identidade Visual

| Token | Valor |
|---|---|
| Cor primária | `#b92526` (vermelho) |
| Cor secundária | `#f0df5a` (amarelo) |
| Cor terciária | `#ec9837` (laranja) |
| Background | `#0a0a0a` |
| Fonte display | Bangers (Google Fonts) |
| Fonte corpo | Inter / system-ui |
| Estética | CRT/Arcade + identidade 90s Burgers |

Logo disponível em `https://redirect90s.vercel.app/assets/logo1.png`.

---

## Arquitetura do Sistema

### Componentes

```
┌─────────────────────────────────────────────────────┐
│                   90s Burgers Hub                    │
├─────────────────────┬───────────────────────────────┤
│   Web App (player)  │     Admin Panel (dono)         │
│   Next.js / mobile  │     Next.js / desktop          │
├─────────────────────┴───────────────────────────────┤
│                  Supabase                            │
│  PostgreSQL + Auth + Realtime + Edge Functions       │
├─────────────────────────────────────────────────────┤
│              Saipos Webhook (integração)             │
│  Pedido confirmado → Edge Function → +fichas        │
└─────────────────────────────────────────────────────┘
```

### Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + Bangers font
- **Backend/DB:** Supabase (PostgreSQL + Realtime + Auth + Edge Functions)
- **Integração:** Saipos webhook → Supabase Edge Function
- **Deploy:** Vercel

---

## Banco de Dados

### Tabelas

```sql
players (
  id          uuid PRIMARY KEY,
  nickname    text UNIQUE NOT NULL,
  phone       text UNIQUE NOT NULL,   -- lead capturado
  created_at  timestamptz DEFAULT now()
)

games (
  id              uuid PRIMARY KEY,
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  active          boolean DEFAULT false,
  top_n_discount  int DEFAULT 3,       -- top N ganham desconto
  discount_pct    int DEFAULT 10,      -- % de desconto
  season          int DEFAULT 1
)

scores (
  id          uuid PRIMARY KEY,
  player_id   uuid REFERENCES players,
  game_id     uuid REFERENCES games,
  score       int NOT NULL,
  wave        int,
  season      int NOT NULL DEFAULT 1,   -- filtra ranking por temporada
  created_at  timestamptz DEFAULT now()
)

fichas (
  id          uuid PRIMARY KEY,
  player_id   uuid REFERENCES players,
  amount      int NOT NULL,            -- positivo = crédito, negativo = débito
  reason      text,                    -- 'pedido_saipos' | 'bonus' | 'jogo'
  ref_id      text,                    -- id do pedido Saipos
  created_at  timestamptz DEFAULT now()
)

-- View: ranking atual por game (melhor score por player na temporada ativa)
CREATE VIEW ranking AS
  WITH best AS (
    SELECT s.game_id, s.player_id, MAX(s.score) AS score
    FROM scores s
    JOIN games g ON g.id = s.game_id
    WHERE s.season = g.season
    GROUP BY s.game_id, s.player_id
  )
  SELECT
    game_id, player_id, score,
    RANK() OVER (PARTITION BY game_id ORDER BY score DESC) AS position
  FROM best;

-- View: descontos ativos
CREATE VIEW active_discounts AS
  SELECT r.player_id, r.game_id, g.discount_pct
  FROM ranking r
  JOIN games g ON g.id = r.game_id
  WHERE r.position <= g.top_n_discount AND g.active = true;
```

---

## Telas — Web App (Player)

### 1. Hub Home (`/`)
- Top bar: logo 90s Burgers + saldo de fichas do jogador
- Hero: "JOGAR E GANHAR" + CTA "INSERIR FICHA" → login/cadastro se não autenticado
- Grid 2×2 de games: Burger Invaders (ativo) + 3 slots "EM BREVE"
- Preview do ranking: top 2 com badge `-10%`
- Fluxo: não autenticado → modal de cadastro (nickname + telefone) → retorna à home

### 2. Burger Invaders (`/games/burger-invaders`)
- Stats bar: SCORE / WAVE / HI-SCORE
- Área de jogo:
  - Background: gradiente espacial roxo/escuro + estrelas + silhueta de cidade pixel art
  - 3 linhas de inimigos: aliens 👾 (linha 1), burgers 🍔 (linha 2), batatas 🍟 (linha 3)
  - Canhão: pixel art de hamburguer (pão laranja, gergelim amarelo, patty marrom, canhões vermelhos)
  - Bala: retângulo amarelo
- Controles touch: ◀ FIRE ▶ (mobile); teclado em desktop
- Game over: salva score → exibe posição no ranking → CTA de pedido + botão de compartilhar

### 3. Tela de Game Over (`/games/burger-invaders/game-over`)
- Score final + posição no ranking
- Card compartilhável (OG image gerada): "Fiz X pts no Burger Invaders! Estou em #N 👾"
- Botões: COMPARTILHAR (WhatsApp/Instagram) | PEDIR AGORA | JOGAR DE NOVO
- Se fichas disponíveis: "Você tem X fichas — use para vida extra!"

### 4. Leaderboard (`/ranking`)
- Tabs por jogo
- Banner "SUA POSIÇÃO: #N" com score atual
- Top 3: medalha + nome + score + badge `-10%`
- Top 4-10: sem badge
- Linha do jogador destacada (laranja) com distância pro top 3

---

## Telas — Admin Panel (`/admin`)

### Dashboard
- KPIs: total de players, fichas distribuídas, descontos ativos, pedidos gerados (R$)
- Ranking atual com telefones dos top 3
- Painel Saipos: status de conexão, regra de fichas, log dos últimos pedidos

### Players / Leads (`/admin/players`)
- Tabela: nickname, telefone, score, desconto ativo, fichas, último acesso
- Exportar CSV (lista de leads para WhatsApp/CRM)
- Grant manual de fichas

### Games (`/admin/games`)
- Ativar/desativar games
- Configurar top N e % de desconto por game
- Iniciar nova temporada (reseta rankings)

### Fichas (`/admin/fichas`)
- Regras: N fichas por pedido, bônus por valor (ex: acima de R$50 = +1)
- Histórico de créditos
- Grant/debit manual por player

### Integração Saipos (`/admin/saipos`)
- Status do webhook
- Log de pedidos recebidos e fichas creditadas
- Configurar regras de fichas por valor de pedido

---

## Integração Saipos

```
Pedido confirmado no Saipos
→ POST webhook → /api/saipos/webhook
→ Supabase Edge Function valida assinatura
→ Busca player pelo telefone do pedido
→ Calcula fichas (regra configurada no admin)
→ INSERT em fichas com reason='pedido_saipos'
→ Supabase Realtime notifica o hub em tempo real
→ Player vê fichas atualizadas na top bar
```

**Pendente:** documentação da API Saipos (a ser fornecida pelo Elias). Especificamente:
- Formato do payload do webhook
- Autenticação/assinatura do webhook
- Campo que contém o telefone do cliente
- Campo de valor total do pedido

---

## Mecânicas de Valor (Growth)

| Mecânica | Como funciona |
|---|---|
| **Lead capture** | Cadastro com telefone obrigatório para entrar no ranking |
| **Viralidade** | Card de score compartilhável no WhatsApp/Instagram com link do hub |
| **Loop fichas** | 1 pedido = 3 fichas; fichas = vidas extras no jogo |
| **CTA pós-jogo** | Game over → tela com botão direto pro delivery |
| **Temporadas** | Ranking mensal reseta → urgência renovada todo mês |
| **Desconto vitalício** | Top 3 têm desconto ativo enquanto mantiverem posição |

---

## Fluxo Principal

```
Novo usuário descobre o hub (link compartilhado ou QR)
→ Vê o game, clica "INSERIR FICHA"
→ Cadastra nickname + telefone (lead capturado)
→ Joga Burger Invaders
→ Game over → vê posição no ranking
→ Compartilha score no WhatsApp (viralidade)
→ Vê CTA "Peça agora e ganhe fichas"
→ Faz pedido no Saipos
→ Webhook credita fichas automaticamente
→ Volta pra jogar com as fichas extras
→ Sobe no ranking → ganha desconto
→ Loop reinicia
```

---

## Fora de Escopo (fase 2+)

- App mobile nativo
- Jogo beat 'em up (Dragon Burger)
- Integração com iFood
- Sistema de cupons automáticos no Saipos
- Múltiplos jogos ativos simultâneos

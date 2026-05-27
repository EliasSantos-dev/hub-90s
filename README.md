# Hub 90s 🕹️🍔

Plataforma full-stack que une **arcade retrô** e **operação de restaurante**: os clientes jogam games estilo anos 90 (como *Burger Invaders*), acumulam e gastam **fichas**, e tudo é gerido por um painel administrativo integrado ao PDV **Saipos** via webhooks.

Construído com **Next.js** (App Router) e **Supabase**.

## ✨ Destaques

- 🎮 **Games próprios** — ex.: *Burger Invaders*, com tela de game over
- 🎟️ **Sistema de fichas** — endpoints para creditar (`/api/fichas/claim`) e debitar (`/api/fichas/debit`)
- 🔗 **Integração com PDV Saipos** — webhook em `/api/webhooks/saipos`
- 🛠️ **Painel administrativo** — gestão de fichas, games, players e configuração Saipos, com login protegido
- 🏆 **Ranking** público de jogadores

## 🧱 Stack

- **Next.js** (App Router + Route Handlers)
- **React** + **TypeScript**
- **Supabase** (Postgres + Auth)
- **Tailwind CSS**

## 🗂️ Estrutura

```
src/app
├── admin/        # painel: fichas, games, players, saipos, login
├── api/
│   ├── fichas/   # claim, debit
│   └── webhooks/ # integração saipos
├── games/        # burger-invaders, ...
└── ranking/      # placar público
```

## 🚀 Rodando localmente

```bash
npm install
# configure as variáveis do Supabase em .env.local
npm run dev
```

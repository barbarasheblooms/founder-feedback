# SheBlooms Feedback Hub

A shared team tool to centralize, analyze, and diagnose founder feedback using AI.
Built with Next.js + Supabase + Anthropic API. Deploy on Vercel in ~10 minutes.

---

## What it does

- Any team member can add feedback from LinkedIn, Sembly meetings, emails, PDFs, or images
- AI extracts themes, pain points, requests, and opportunities from each entry
- Shared library updates in real-time for the whole team (Supabase realtime)
- Chat with the AI about the full library — ask anything, get data-backed answers
- Diagnosis tab generates a consolidated strategic analysis across all entries

---

## Setup (step by step)

### 1. Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor → New query**
3. Paste the contents of `supabase/schema.sql` and click **Run**
4. Go to **Project Settings → API**
5. Copy your **Project URL** and **anon public** key — you'll need them in step 3

### 2. Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key under **API Keys**
3. Copy it — you'll need it in step 3

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-your-key
```

### 4. Deploy to Vercel

**Option A — Vercel CLI (fastest)**
```bash
npm install -g vercel
vercel --prod
```
When prompted, add your 3 environment variables.

**Option B — GitHub + Vercel dashboard**
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo
3. In the deployment settings, add your 3 environment variables
4. Click Deploy

### 5. Share with your team

Send the Vercel URL to your team. Each person enters their name in the "You are:" bar — it saves automatically in their browser. All feedback is shared instantly via Supabase realtime.

---

## Local development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend + API routes | Next.js 14 (App Router) |
| Database + Realtime | Supabase (PostgreSQL) |
| AI analysis | Anthropic Claude Sonnet |
| Hosting | Vercel |

---

## File structure

```
app/
  page.jsx              ← Full hub UI (React)
  layout.jsx            ← Root layout
  globals.css           ← All styles
  api/
    analyze/route.js    ← Anthropic proxy: analyze one feedback
    chat/route.js       ← Anthropic proxy: chat with library
    diagnosis/route.js  ← Anthropic proxy: consolidated diagnosis
lib/
  supabase.js           ← Supabase client
supabase/
  schema.sql            ← Run this once to set up the DB
```

# AI Support Reply Suggestor (MVP)

A lightweight web app that helps support reps reply faster by generating AI-drafted customer support responses.  

## Goal
Paste a customer message → choose tone → click **Generate** → get 3 reply drafts (<150 words each) → copy best one.  

## Acceptance Criteria (Day-1)
- Textarea input (≥10 chars, truncate >2500).  
- Tone picker: Friendly / Professional / Concise.  
- Generate button → calls `/api/generate` → returns `{ drafts: string[] }`.  
- Show 3 drafts in cards, each with **Copy** button.  
- Free tier: 5 generations/day (tracked in `localStorage`).  
- After 5, show **Upgrade modal** with Stripe Checkout link.  
- `/thank-you` page accepts unlock code `PRO-DEMO-2025` → sets `localStorage.proUnlocked=true`.  
- **Privacy note:** “We don’t store your messages. They’re sent to our AI provider to generate replies, then discarded.”  

## Tech Stack
- **Framework:** Next.js (App Router, TypeScript)  
- **Styling:** Tailwind CSS  
- **AI:** OpenAI `gpt-4o-mini` (chat completions API)  
- **Payments:** Stripe Checkout (subscription mode, test keys)  
- **Hosting:** Vercel  
- **Storage:** None (use `localStorage` for gating)  

## Guardrails
- Always <150 words.  
- No hallucinated policies.  
- If info missing, add a clarifying question.  
- De-escalate abusive inputs politely.  
- Timeout 15s; handle errors with retry.  

## Minimal File Structure
- app/
- page.tsx
- thank-you/page.tsx
- api/generate/route.ts
- api/create-checkout-session/route.ts
- components/
- ReplyCard.tsx
- lib/
- openai.ts


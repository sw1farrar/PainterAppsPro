# PainterApps Pro

Paint job estimating for professional contractors. Dense, utilitarian UI — precision tool, not consumer SaaS.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill DATABASE_URL + DIRECT_URL from Supabase
npx prisma migrate deploy
npm run db:seed              # demo customer + estimate + catalogs
npm run dev                  # http://localhost:3000
```

Open the seeded estimate from the Dashboard and explore the builder.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + Supabase Postgres
- Tailwind + shadcn/ui
- Zod / react-hook-form patterns, Zustand-ready calc utils
- Printable proposals (browser Print → PDF)

## First things to calibrate

1. **Settings → Production Rates** — replace seed averages with your crew’s real sqft/man-hour.
2. **Settings → Paint Products** — update coverage and your actual gallon costs.
3. **Settings → Business** — company info, labor rate, markup, waste %, tax.

See **Help / Rates** in the app for formulas.

## Calculations

```
Gallons   = (sqft × coats × (1 + waste%)) ÷ coverage
Labor hrs = (measure × coats) ÷ production_rate
Material$ = gallons × $/gal × (1 + markup%)
Labor$    = hours × blended_labor_rate
```

All calc logic lives in `src/lib/calculations.ts` (pure, testable).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run db:seed` | Seed catalogs + demo estimate |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run build` | Production build |

## Out of scope (MVP)

Customer portal, multi-user, scheduling/dispatch, invoicing, AI takeoff.

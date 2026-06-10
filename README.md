# Daito

A **Next.js** app hosting an **MCP (Model Context Protocol) server** at `/api/mcp` with screener tools for Indian markets.

## Tools

### `query_india_screener` — Indian stocks (screener.in)

Runs [screener.in](https://www.screener.in/)'s query language against NSE/BSE-listed equities:

```
Market Capitalization > 500 AND Price to earning < 15 AND Return on capital employed > 22
```

- 100+ fundamental ratios with annual, quarterly, and multi-year growth variants
- Queries are limited to **1500 characters** (~40 conditions) by screener.in
- **Requires a screener.in account** — ad-hoc queries are login-gated. Set
  `SCREENER_IN_EMAIL` and `SCREENER_IN_PASSWORD` (free account at
  [screener.in/register](https://www.screener.in/register/))

### `get_india_fund_screener` — Indian mutual funds (Morningstar India)

Screens ~12,700 India-domiciled open-end fund share classes via Morningstar India's public API. No credentials required.

- Filter by category (55 Morningstar India categories), star rating, risk rating, expense ratio, AUM, yield, manager tenure, and trailing returns (1D → 10Y)
- Each fund appears once per share class (Direct/Regular × Growth/IDCW); use `term: "Dir Gr"` to narrow to direct growth plans
- All monetary values in INR; NAVs update once daily

## Build & Run

```bash
bun install
bun run dev           # next dev — local development
bun run build         # next build
bun run start         # next start — production
bun run typecheck     # tsc --noEmit
```

## Environment Variables

Copy `.env.example` to `.env`:

- `SCREENER_IN_EMAIL` — screener.in login email (for `query_india_screener`)
- `SCREENER_IN_PASSWORD` — screener.in password

## Architecture

```
MCP Tool Handler (mcp-handler, app/api/[transport]/route.ts)
    ↓ (Zod validation)
Service layer (lib/services/)
    ↓
screener.in (session login + HTML parsing) / Morningstar India ecint API (public token)
```

- `lib/services/screener-in.ts` — logs in with a Django CSRF flow, caches the session cookie, runs queries against `/screen/raw/`, parses the results table with cheerio. Re-authenticates automatically when the session expires.
- `lib/services/india-fund-screener.ts` — scrapes a public retail JWT from Morningstar India's quickrank page and queries the `ecint/v1/screener` API (universe `FOIND$$ALL`). Token auto-refreshes from the JWT `exp` claim.

## Deployment

Vercel. `vercel.json` sets `maxDuration: 60` on the `[transport]` route. Node runtime.

# Daito

MCP server for screening Indian stocks and mutual funds. Wraps [screener.in](https://www.screener.in/) and Morningstar India so you can run fundamental queries straight from Claude or Cursor.

Deployed as a Next.js app on Vercel. The MCP endpoint is at `/api/mcp`.

## Tools

### `query_india_screener`

Runs screener.in's query language against NSE/BSE-listed equities. Same syntax you'd use on the website:

```
Market Capitalization > 500 AND Price to earning < 15 AND Return on capital employed > 22
```

Supports 100+ fundamental ratios including annual, quarterly, and multi-year growth variants. Screener.in caps queries at 1500 characters (~40 conditions).

Requires a screener.in account. Ad-hoc queries are login-gated on their end, so you'll need to set `SCREENER_IN_EMAIL` and `SCREENER_IN_PASSWORD`. Free account at [screener.in/register](https://www.screener.in/register/).

### `get_india_fund_screener`

Screens ~12,700 India-domiciled open-end fund share classes via Morningstar India's API. No credentials needed.

Filters: category (55 Morningstar India categories), star rating, risk rating, expense ratio, AUM, yield, manager tenure, trailing returns (1D to 10Y). Each fund shows up once per share class (Direct/Regular × Growth/IDCW); use `term: "Dir Gr"` to narrow to direct growth plans. Values in INR, NAVs update daily.

## Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "daito": {
      "url": "https://your-deployment.vercel.app/api/mcp"
    }
  }
}
```

Restart Claude Desktop. For local dev, swap in `http://localhost:3000/api/mcp`.

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "daito": {
      "url": "https://your-deployment.vercel.app/api/mcp"
    }
  }
}
```

Restart Cursor. For local dev, use `http://localhost:3000/api/mcp`.

## Running locally

```bash
bun install
cp .env.example .env   # fill in screener.in credentials
bun run dev
```

Other commands:

```bash
bun run build      # production build
bun run start      # serve production build
bun run typecheck  # tsc --noEmit
```

## Environment variables

`SCREENER_IN_EMAIL` and `SCREENER_IN_PASSWORD` are only needed for `query_india_screener`. The fund screener works without credentials.

## How it works

```
app/api/[transport]/route.ts  (mcp-handler, Zod validation)
    ↓
lib/services/
    ├── screener-in.ts          → Django CSRF login → /screen/raw/ → cheerio HTML parse
    └── india-fund-screener.ts  → public Morningstar JWT → ecint/v1/screener (FOIND$$ALL)
```

The screener.in service does a Django CSRF login, caches the session cookie, and re-auths when it expires. The Morningstar service scrapes a public retail JWT from their quickrank page and refreshes it from the JWT `exp` claim.

## Deployment

Hosted on Vercel. `vercel.json` bumps `maxDuration` to 60s on the transport route since screener.in can be slow. Node runtime.

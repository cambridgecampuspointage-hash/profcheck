<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Goal
- Build a per-profile API token system for secure MCP server access and create the related management UI.

## Constraints & Preferences
- Use ProfCheck brand style (cream/gold/navy) for all UI pages.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to users; replace with per-user `MCP_TOKEN`.
- MCP server validates token against `mcp_tokens` table on startup.
- Users generate/list/revoke tokens from dashboard settings.
- Mobile responsive, zero `any`, Framer Motion animations, lucide-react icons.

## Progress
### Done
- Created `supabase/migrations/0019_mcp_tokens.sql` – per-profile token table with RLS.
- Added MCP token server actions in `src/lib/actions.ts` (`listMcpTokens`, `generateMcpToken`, `revokeMcpToken`, `deleteMcpToken`).
- Updated `mcp-server.js` – removed need for user-facing `SUPABASE_SERVICE_ROLE_KEY`, now validates `MCP_TOKEN` against DB on startup.
- Updated `.codex/config.toml` – added `MCP_TOKEN` env var.
- Rewrote `src/app/dashboard/parametres/mcp-tokens/page.tsx` – token management + config guide inline (no more navigation to separate `/mcp` page).
- Added `/mcp` and `/marketing` to middleware public paths list.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Token management UI uses imported server actions directly instead of `fetch` to an API route, consistent with the rest of the dashboard.
- `/mcp` page is now authenticated and displays the current user's personal tokens alongside the integration guide.
- `/dashboard/parametres/mcp-tokens` page now has the complete config guide inline (tool grid + config block), so users never navigate away from parameters.
- Replaced `SUPABASE_SERVICE_ROLE_KEY` in user-facing config examples with `MCP_TOKEN`.
- Token prefix `pc_mcp_` with 32 bytes crypto random.
- MCP server validates token once at startup (not per-call) for performance, updates `last_used_at`.
- Tokens can be active/revoked (soft) or deleted (hard).

## Next Steps
1. Test end-to-end: generate token → use with MCP server → verify DB queries.
2. Verify build compiles with `npx next build` (Node.js in `/usr/local/bin/`).
3. Apply migration `0019_mcp_tokens.sql` to Supabase if not yet applied.

## Relevant Files
- `supabase/migrations/0019_mcp_tokens.sql`: Token table schema and RLS policies
- `src/lib/actions.ts` (bottom): Token CRUD server actions
- `mcp-server.js`: Token validation on startup, uses `MCP_TOKEN` env var
- `src/app/dashboard/parametres/mcp-tokens/page.tsx`: Token management + config guide inline (tool grid, config card, copy)
- `src/app/mcp/page.tsx`: Standalone page with token management + per-tool integration configs
- `.codex/config.toml`: MCP server env vars updated with `MCP_TOKEN`
- `src/lib/supabase/middleware.ts`: Public paths updated for `/mcp` and `/marketing`

-- MCP Tokens: per-profile API tokens for MCP server access

CREATE TABLE IF NOT EXISTS public.mcp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'default',
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_token ON public.mcp_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_profile_id ON public.mcp_tokens(profile_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_active ON public.mcp_tokens(is_active);

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;

-- Each user can manage their own tokens
DROP POLICY IF EXISTS "Users manage own tokens" ON public.mcp_tokens;
CREATE POLICY "Users manage own tokens" ON public.mcp_tokens
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- Admins can see all tokens
DROP POLICY IF EXISTS "Admins see all tokens" ON public.mcp_tokens;
CREATE POLICY "Admins see all tokens" ON public.mcp_tokens
  FOR SELECT USING (public.is_admin());

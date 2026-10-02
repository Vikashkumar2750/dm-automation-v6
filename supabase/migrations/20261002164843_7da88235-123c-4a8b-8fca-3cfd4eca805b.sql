CREATE TABLE public.conversation_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_text text NOT NULL DEFAULT '',
  intent text NOT NULL DEFAULT 'other',
  sentiment text NOT NULL DEFAULT 'neutral',
  lead_score int NOT NULL DEFAULT 0,
  confidence int NOT NULL DEFAULT 0,
  decision text NOT NULL DEFAULT 'handoff',
  reply_text text,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_insights_org_idx ON public.conversation_insights (organization_id, created_at DESC);
GRANT SELECT ON public.conversation_insights TO authenticated;
GRANT ALL ON public.conversation_insights TO service_role;
ALTER TABLE public.conversation_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view insights" ON public.conversation_insights FOR SELECT TO authenticated
  USING (public.current_user_is_org_member(organization_id));
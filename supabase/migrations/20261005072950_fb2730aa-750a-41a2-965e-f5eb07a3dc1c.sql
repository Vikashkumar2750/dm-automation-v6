CREATE INDEX IF NOT EXISTS webhook_events_org_received_idx ON public.webhook_events(organization_id, received_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_sent_idx ON public.messages(conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS automation_runs_org_created_idx ON public.automation_runs(organization_id, created_at DESC);
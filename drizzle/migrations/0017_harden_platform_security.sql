-- 1. Prevent org admins from granting owner-level membership
DROP POLICY IF EXISTS "members insert admin or self-bootstrap" ON public.organization_members;
CREATE POLICY "members insert admin or self-bootstrap"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  (
    role <> 'owner'::org_role
    AND public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role])
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_members.organization_id AND o.owner_id = auth.uid()
  )
);

-- Prevent admins from promoting an existing member to owner
DROP POLICY IF EXISTS "members update admin" ON public.organization_members;
CREATE POLICY "members update admin"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]))
WITH CHECK (
  (
    role <> 'owner'::org_role
    AND public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role])
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_members.organization_id AND o.owner_id = auth.uid()
  )
);

-- Invitations must not hand out owner role either
DROP POLICY IF EXISTS "invites insert managers" ON public.organization_invitations;
CREATE POLICY "invites insert managers"
ON public.organization_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  role <> 'owner'::org_role
  AND public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role])
);

-- 2. Pin search_path on the trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end;
$function$;

-- 3. Lock down SECURITY DEFINER function execution
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_platform_role(uuid, platform_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_org(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_unread(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_platform_role(uuid, platform_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_org(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_unread(uuid) TO service_role;

-- 4. Safer automation defaults so new workspaces cannot get platform-banned
ALTER TABLE public.automation_settings ALTER COLUMN quiet_hours_enabled SET DEFAULT true;
ALTER TABLE public.automation_settings ALTER COLUMN per_contact_daily_limit SET DEFAULT 3;
ALTER TABLE public.automation_settings ALTER COLUMN hourly_send_limit SET DEFAULT 60;
ALTER TABLE public.automation_settings ALTER COLUMN daily_send_limit SET DEFAULT 500;
ALTER TABLE public.automation_settings ALTER COLUMN viral_threshold_per_minute SET DEFAULT 20;

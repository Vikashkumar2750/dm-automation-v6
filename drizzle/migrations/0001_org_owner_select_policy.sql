drop policy "orgs select member" on public.organizations;
create policy "orgs select member" on public.organizations for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_org_member(id, auth.uid())
    or public.has_platform_role(auth.uid(), 'super_admin')
  );
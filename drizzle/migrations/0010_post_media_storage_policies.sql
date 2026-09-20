CREATE POLICY "post media members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'post-media'
  AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "post media writers upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'post-media'
  AND public.has_org_role((storage.foldername(name))[1]::uuid, auth.uid(), ARRAY['owner','admin','manager']::org_role[])
);

CREATE POLICY "post media writers delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'post-media'
  AND public.has_org_role((storage.foldername(name))[1]::uuid, auth.uid(), ARRAY['owner','admin','manager']::org_role[])
);
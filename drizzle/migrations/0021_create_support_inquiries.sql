CREATE TABLE IF NOT EXISTS public.support_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  email_notification_status text NOT NULL DEFAULT 'pending',
  email_notification_error text,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_inquiries_status_valid CHECK (status IN ('open', 'resolved')),
  CONSTRAINT support_inquiries_email_status_valid CHECK (email_notification_status IN ('pending', 'sent', 'failed')),
  CONSTRAINT support_inquiries_category_valid CHECK (category IN ('general', 'technical', 'billing', 'privacy', 'partnership')),
  CONSTRAINT support_inquiries_name_length CHECK (char_length(name) BETWEEN 2 AND 100),
  CONSTRAINT support_inquiries_email_length CHECK (char_length(email) BETWEEN 3 AND 200),
  CONSTRAINT support_inquiries_subject_length CHECK (char_length(subject) BETWEEN 3 AND 160),
  CONSTRAINT support_inquiries_message_length CHECK (char_length(message) BETWEEN 10 AND 4000)
);

GRANT SELECT, UPDATE ON public.support_inquiries TO authenticated;
GRANT ALL ON public.support_inquiries TO service_role;

ALTER TABLE public.support_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can read support inquiries" ON public.support_inquiries;
CREATE POLICY "Super admins can read support inquiries"
ON public.support_inquiries
FOR SELECT
TO authenticated
USING (public.current_user_has_platform_role('super_admin'));

DROP POLICY IF EXISTS "Super admins can update support inquiries" ON public.support_inquiries;
CREATE POLICY "Super admins can update support inquiries"
ON public.support_inquiries
FOR UPDATE
TO authenticated
USING (public.current_user_has_platform_role('super_admin'))
WITH CHECK (public.current_user_has_platform_role('super_admin'));

CREATE INDEX IF NOT EXISTS support_inquiries_created_at_idx ON public.support_inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS support_inquiries_status_created_at_idx ON public.support_inquiries (status, created_at DESC);

DROP TRIGGER IF EXISTS support_inquiries_updated_at ON public.support_inquiries;
CREATE TRIGGER support_inquiries_updated_at
BEFORE UPDATE ON public.support_inquiries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- Read-only metadata. No customer data or secret values returned.
-- Run on the affected live database, not the connected preview database.
WITH required(table_name, required_columns) AS (VALUES
  ('revenue_products', ARRAY['id','organization_id','created_at']),
  ('delivery_pages', ARRAY['id','organization_id','created_at']),
  ('coupon_campaigns', ARRAY['id','organization_id','created_at']),
  ('revenue_settings', ARRAY['organization_id']),
  ('payment_links', ARRAY['id','organization_id','product_id','platform','external_user_id','provider','url','amount_paise','status','nudged_at','paid_at','created_at']),
  ('revenue_events', ARRAY['organization_id','kind','amount_paise','ref_id','created_at']),
  ('automation_runs', ARRAY['id','organization_id','status','created_at']),
  ('delivery_page_leads', ARRAY['id','organization_id','delivery_page_id','answers','created_at']),
  ('social_accounts', ARRAY['id','organization_id','platform','name','handle','external_id','created_at']),
  ('payment_credentials', ARRAY['organization_id','razorpay_key_id']),
  ('whatsapp_otp_settings', ARRAY['organization_id','phone_number_id','template_name'])
)
SELECT r.table_name,
       to_regclass('public.' || r.table_name) IS NOT NULL AS table_exists,
       ARRAY(SELECT col FROM unnest(r.required_columns) AS col
         WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = r.table_name AND c.column_name = col)) AS missing_columns,
       CASE WHEN to_regclass('public.' || r.table_name) IS NULL THEN NULL
         ELSE has_table_privilege('service_role', 'public.' || r.table_name, 'SELECT') END AS server_select_granted,
       CASE WHEN to_regclass('public.' || r.table_name) IS NULL THEN NULL
         ELSE has_table_privilege('authenticated', 'public.' || r.table_name, 'SELECT') END AS user_select_granted
FROM required r ORDER BY r.table_name;
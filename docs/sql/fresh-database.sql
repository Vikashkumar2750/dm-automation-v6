-- AutoDM by Techaasvik — FULL database setup for a NEW, EMPTY Supabase project.
-- Run ONCE in Supabase → SQL Editor (paste everything → Run).
-- Never run this on a database that already has the app's tables.
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: automation_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_action AS ENUM (
    'reply_dm',
    'comment_public_reply',
    'comment_private_reply',
    'hide_comment',
    'set_status'
);


--
-- Name: automation_match; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_match AS ENUM (
    'any',
    'contains',
    'exact',
    'starts_with'
);


--
-- Name: automation_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_run_status AS ENUM (
    'matched',
    'sent',
    'skipped',
    'failed'
);


--
-- Name: automation_trigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_trigger AS ENUM (
    'dm_received',
    'comment_received',
    'story_reply',
    'story_mention'
);


--
-- Name: conversation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conversation_status AS ENUM (
    'open',
    'pending',
    'resolved'
);


--
-- Name: message_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.message_direction AS ENUM (
    'inbound',
    'outbound'
);


--
-- Name: org_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_role AS ENUM (
    'owner',
    'admin',
    'manager',
    'agent',
    'viewer'
);


--
-- Name: platform_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.platform_role AS ENUM (
    'super_admin',
    'support'
);


--
-- Name: post_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.post_status AS ENUM (
    'draft',
    'scheduled',
    'publishing',
    'published',
    'failed'
);


--
-- Name: social_account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.social_account_status AS ENUM (
    'connected',
    'attention',
    'disconnected'
);


--
-- Name: social_platform; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.social_platform AS ENUM (
    'instagram',
    'facebook',
    'youtube'
);


--
-- Name: webhook_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.webhook_status AS ENUM (
    'received',
    'processed',
    'failed',
    'ignored'
);


--
-- Name: has_org_role(uuid, uuid, public.org_role[]); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.has_org_role(_org_id uuid, _user_id uuid, _roles public.org_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org_id and user_id = _user_id and role = any(_roles)
  )
$$;


--
-- Name: has_platform_role(uuid, public.platform_role); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.has_platform_role(_user_id uuid, _role public.platform_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.platform_roles where user_id = _user_id and role = _role)
$$;


--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.is_org_member(_org_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.organization_members where organization_id = _org_id and user_id = _user_id)
$$;


--
-- Name: shares_org(uuid, uuid); Type: FUNCTION; Schema: app_private; Owner: -
--

CREATE FUNCTION app_private.shares_org(_a uuid, _b uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.organization_members m1
    join public.organization_members m2
      on m1.organization_id = m2.organization_id
    where m1.user_id = _a and m2.user_id = _b
  )
$$;


--
-- Name: consume_ai_request(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_ai_request(_user_id uuid, _limit integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare used integer;
begin
  insert into public.ai_usage_daily (user_id, day, requests) values (_user_id, current_date, 1)
  on conflict (user_id, day) do update set requests = ai_usage_daily.requests + 1
  where ai_usage_daily.requests < _limit
  returning requests into used;
  return coalesce(used, -1);
end $$;


--
-- Name: current_user_has_org_role(uuid, public.org_role[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_has_org_role(_org_id uuid, _roles public.org_role[]) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select app_private.has_org_role(_org_id, auth.uid(), _roles)
$$;


--
-- Name: current_user_has_platform_role(public.platform_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_has_platform_role(_role public.platform_role) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select app_private.has_platform_role(auth.uid(), _role)
$$;


--
-- Name: current_user_is_org_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_is_org_member(_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select app_private.is_org_member(_org_id, auth.uid())
$$;


--
-- Name: increment_unread(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_unread(p_conversation_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.conversations
  set unread_count = unread_count + 1
  where id = p_conversation_id;
$$;


--
-- Name: log_org_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_org_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r jsonb; o jsonb; changed text[] := '{}';
  ignored text[] := ARRAY['updated_at','last_synced_at','last_used_at','cursor_at','last_status','last_error','last_sent_at','metadata','capabilities'];
BEGIN
  IF TG_OP = 'DELETE' THEN r := to_jsonb(OLD); ELSE r := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    o := to_jsonb(OLD);
    SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO changed
      FROM jsonb_object_keys(r) k
      WHERE NOT (k = ANY(ignored)) AND (r -> k) IS DISTINCT FROM (o -> k);
    IF array_length(changed, 1) IS NULL THEN RETURN NULL; END IF;
  END IF;
  IF (r ->> 'organization_id') IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.org_audit_log(organization_id, actor_user_id, action, entity, entity_id, changed_fields)
  VALUES ((r ->> 'organization_id')::uuid, auth.uid(), lower(TG_OP), TG_TABLE_NAME, coalesce(r ->> 'id', r ->> 'organization_id'), changed);
  RETURN NULL;
END $$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin new.updated_at = now(); return new; end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_assistant_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_assistant_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_usage_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_daily (
    user_id uuid NOT NULL,
    day date DEFAULT CURRENT_DATE NOT NULL,
    requests integer DEFAULT 0 NOT NULL
);


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    prefix text NOT NULL,
    key_hash text NOT NULL,
    scopes text[] DEFAULT ARRAY['read'::text] NOT NULL,
    created_by uuid,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_follow_gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_follow_gates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    rule_id uuid,
    conversation_id uuid,
    social_account_id uuid,
    platform public.social_platform NOT NULL,
    external_user_id text NOT NULL,
    comment_external_id text,
    status text DEFAULT 'waiting'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_checked_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT automation_follow_gates_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'completed'::text, 'expired'::text])))
);


--
-- Name: automation_opt_outs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_opt_outs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    platform public.social_platform NOT NULL,
    external_user_id text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    platform public.social_platform,
    trigger public.automation_trigger NOT NULL,
    match_type public.automation_match DEFAULT 'contains'::public.automation_match NOT NULL,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    action public.automation_action NOT NULL,
    response_text text,
    set_status public.conversation_status,
    cooldown_seconds integer DEFAULT 60 NOT NULL,
    daily_limit integer DEFAULT 200 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    response_variations text[] DEFAULT '{}'::text[] NOT NULL,
    target_post_ids text[] DEFAULT '{}'::text[] NOT NULL,
    comment_reply_text text,
    comment_reply_variations text[] DEFAULT '{}'::text[] NOT NULL,
    dm_link_url text,
    dm_button_label text,
    dm_attachment_url text,
    dm_attachment_type text DEFAULT 'none'::text NOT NULL,
    follower_condition text DEFAULT 'any'::text NOT NULL,
    require_follow boolean DEFAULT false NOT NULL,
    follow_prompt_text text,
    CONSTRAINT automation_rules_dm_attachment_type_check CHECK ((dm_attachment_type = ANY (ARRAY['none'::text, 'image'::text, 'video'::text, 'file'::text]))),
    CONSTRAINT automation_rules_follower_condition_check CHECK ((follower_condition = ANY (ARRAY['any'::text, 'followers_only'::text, 'non_followers'::text])))
);


--
-- Name: automation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    rule_id uuid,
    conversation_id uuid,
    message_id uuid,
    status public.automation_run_status DEFAULT 'matched'::public.automation_run_status NOT NULL,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_settings (
    organization_id uuid NOT NULL,
    is_paused boolean DEFAULT false NOT NULL,
    blocked_keywords text[] DEFAULT '{}'::text[] NOT NULL,
    opt_out_keywords text[] DEFAULT ARRAY['stop'::text, 'unsubscribe'::text, 'stop messaging'::text] NOT NULL,
    per_contact_daily_limit integer DEFAULT 3 NOT NULL,
    quiet_hours_enabled boolean DEFAULT true NOT NULL,
    quiet_hours_start integer DEFAULT 22 NOT NULL,
    quiet_hours_end integer DEFAULT 7 NOT NULL,
    timezone_offset_minutes integer DEFAULT 330 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hourly_send_limit integer DEFAULT 60 NOT NULL,
    daily_send_limit integer DEFAULT 500 NOT NULL,
    viral_guard_enabled boolean DEFAULT true NOT NULL,
    viral_threshold_per_minute integer DEFAULT 20 NOT NULL,
    viral_cooldown_minutes integer DEFAULT 15 NOT NULL,
    auto_paused_until timestamp with time zone,
    auto_pause_reason text,
    takeover_minutes integer DEFAULT 60 NOT NULL,
    CONSTRAINT automation_settings_takeover_minutes_check CHECK (((takeover_minutes >= 5) AND (takeover_minutes <= 10080)))
);


--
-- Name: blog_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text DEFAULT ''::text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    cover_url text,
    cover_alt text,
    category_id uuid,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    author_name text DEFAULT 'Techaasvik Team'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    seo_title text,
    meta_description text,
    focus_keyword text,
    canonical_url text,
    noindex boolean DEFAULT false NOT NULL,
    faq jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blog_posts_slug_format CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT blog_posts_status_valid CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'published'::text])))
);


--
-- Name: broadcasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.broadcasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    message text NOT NULL,
    filter jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT broadcasts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sending'::text, 'done'::text, 'failed'::text])))
);


--
-- Name: client_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    client_organization_id uuid NOT NULL,
    period_label text NOT NULL,
    amount_inr numeric(12,2) NOT NULL,
    status text DEFAULT 'unpaid'::text NOT NULL,
    payment_url text,
    notes text,
    paid_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_invoices_amount_inr_check CHECK ((amount_inr > (0)::numeric)),
    CONSTRAINT client_invoices_status_check CHECK ((status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'void'::text])))
);


--
-- Name: contact_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    platform text NOT NULL,
    external_user_id text NOT NULL,
    email text,
    phone text,
    notes text,
    custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    filter jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    platform text NOT NULL,
    external_user_id text NOT NULL,
    tag text NOT NULL,
    source text DEFAULT 'flow'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_assignments (
    conversation_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    assigned_to uuid,
    assigned_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    conversation_id uuid,
    message_text text DEFAULT ''::text NOT NULL,
    intent text DEFAULT 'other'::text NOT NULL,
    sentiment text DEFAULT 'neutral'::text NOT NULL,
    lead_score integer DEFAULT 0 NOT NULL,
    confidence integer DEFAULT 0 NOT NULL,
    decision text DEFAULT 'handoff'::text NOT NULL,
    reply_text text,
    provider text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_nudge_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_nudge_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    social_account_id uuid,
    platform public.social_platform NOT NULL,
    external_user_id text NOT NULL,
    external_user_name text,
    channel text DEFAULT 'dm'::text NOT NULL,
    status public.conversation_status DEFAULT 'open'::public.conversation_status NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_preview text,
    unread_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bot_paused_at timestamp with time zone,
    bot_paused_until timestamp with time zone,
    bot_paused_by uuid,
    bot_paused_reason text
);


--
-- Name: coupon_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    prefix text NOT NULL,
    discount_label text NOT NULL,
    max_codes integer DEFAULT 500 NOT NULL,
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupon_campaigns_prefix_check CHECK ((prefix ~ '^[A-Z0-9]{2,12}$'::text))
);


--
-- Name: coupon_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code text NOT NULL,
    platform text NOT NULL,
    external_user_id text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_sync_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_sync_settings (
    organization_id uuid NOT NULL,
    webhook_url text,
    enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delivery_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    body text,
    button_label text,
    button_url text,
    product_id uuid,
    active boolean DEFAULT true NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_pages_slug_check CHECK ((slug ~ '^[a-z0-9-]{3,60}$'::text))
);


--
-- Name: flow_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flow_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    conversation_id uuid,
    flow_id text NOT NULL,
    flow_name text DEFAULT ''::text NOT NULL,
    state jsonb DEFAULT '{}'::jsonb NOT NULL,
    next_step integer DEFAULT 0 NOT NULL,
    resume_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: growth_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.growth_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    handle text,
    platform text DEFAULT 'instagram'::text NOT NULL,
    followers integer DEFAULT 0 NOT NULL,
    posts_per_week numeric DEFAULT 0 NOT NULL,
    avg_comments numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    direction public.message_direction NOT NULL,
    body text NOT NULL,
    external_id text,
    sender_name text,
    sent_by uuid,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nudge_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nudge_settings (
    organization_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    delay_minutes integer DEFAULT 120 NOT NULL,
    text text DEFAULT 'Hi! Just checking in — can I help you with anything?'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nudge_settings_delay_minutes_check CHECK (((delay_minutes >= 15) AND (delay_minutes <= 1200)))
);


--
-- Name: oauth_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_states (
    state text NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    platform public.social_platform NOT NULL,
    redirect_path text DEFAULT '/social-accounts'::text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:15:00'::interval) NOT NULL
);


--
-- Name: org_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id text,
    changed_fields text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    email text NOT NULL,
    role public.org_role DEFAULT 'agent'::public.org_role NOT NULL,
    token text NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.org_role DEFAULT 'viewer'::public.org_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    plan text DEFAULT 'starter'::text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    brand_name text,
    logo_url text,
    brand_color text,
    support_email text,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    parent_organization_id uuid,
    plan_expires_at timestamp with time zone,
    plan_source text DEFAULT 'manual'::text NOT NULL
);


--
-- Name: outgoing_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outgoing_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    url text NOT NULL,
    secret text NOT NULL,
    events text[] DEFAULT ARRAY['message.received'::text] NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    cursor_at timestamp with time zone DEFAULT now() NOT NULL,
    last_status integer,
    last_error text,
    last_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_credentials (
    organization_id uuid NOT NULL,
    razorpay_key_id text NOT NULL,
    razorpay_key_secret text NOT NULL,
    webhook_secret text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    product_id uuid,
    conversation_id uuid,
    social_account_id uuid,
    platform text NOT NULL,
    external_user_id text NOT NULL,
    provider text NOT NULL,
    provider_link_id text,
    url text NOT NULL,
    amount_paise integer NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    nudged_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_links_provider_check CHECK ((provider = ANY (ARRAY['razorpay'::text, 'manual'::text]))),
    CONSTRAINT payment_links_status_check CHECK ((status = ANY (ARRAY['created'::text, 'paid'::text, 'expired'::text])))
);


--
-- Name: plan_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    created_by uuid,
    plan text NOT NULL,
    billing_cycle text NOT NULL,
    amount_paise integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    provider text DEFAULT 'razorpay'::text NOT NULL,
    mode text DEFAULT 'live'::text NOT NULL,
    provider_order_id text,
    provider_payment_id text,
    status text DEFAULT 'created'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone
);


--
-- Name: platform_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    actor_email text,
    action text NOT NULL,
    target_type text,
    target_id text,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.platform_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id boolean DEFAULT true NOT NULL,
    global_send_paused boolean DEFAULT false NOT NULL,
    incident_banner text,
    feature_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_settings_id_check CHECK (id)
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    social_account_id uuid,
    platform public.social_platform NOT NULL,
    caption text DEFAULT ''::text NOT NULL,
    media_url text,
    media_type text DEFAULT 'image'::text NOT NULL,
    scheduled_at timestamp with time zone,
    status public.post_status DEFAULT 'draft'::public.post_status NOT NULL,
    external_post_id text,
    permalink text,
    error text,
    published_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    media_urls text[] DEFAULT '{}'::text[] NOT NULL,
    post_format text DEFAULT 'feed'::text NOT NULL,
    group_id uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reply_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reply_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by uuid NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reply_approvals_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000))),
    CONSTRAINT reply_approvals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: revenue_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revenue_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    kind text NOT NULL,
    platform text,
    external_user_id text,
    ref_id uuid,
    amount_paise integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT revenue_events_kind_check CHECK ((kind = ANY (ARRAY['page_view'::text, 'page_click'::text, 'payment_link'::text, 'paid'::text, 'coupon'::text, 'nudge'::text])))
);


--
-- Name: revenue_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revenue_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price_paise integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    manual_url text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT revenue_products_price_paise_check CHECK ((price_paise >= 100))
);


--
-- Name: revenue_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revenue_settings (
    organization_id uuid NOT NULL,
    nudge_enabled boolean DEFAULT false NOT NULL,
    nudge_delay_minutes integer DEFAULT 120 NOT NULL,
    nudge_text text DEFAULT 'Hi! Your payment link is still waiting. Need any help completing it?'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT revenue_settings_nudge_delay_minutes_check CHECK (((nudge_delay_minutes >= 15) AND (nudge_delay_minutes <= 1200)))
);


--
-- Name: scheduler_heartbeats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduler_heartbeats (
    job text NOT NULL,
    last_run_at timestamp with time zone DEFAULT now() NOT NULL,
    last_ok_at timestamp with time zone,
    last_status integer,
    last_duration_ms integer,
    consecutive_failures integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: social_account_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_account_tokens (
    social_account_id uuid NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: social_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    platform public.social_platform NOT NULL,
    external_id text NOT NULL,
    name text NOT NULL,
    handle text,
    avatar_url text,
    status public.social_account_status DEFAULT 'connected'::public.social_account_status NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    capabilities jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    token_expires_at timestamp with time zone,
    last_synced_at timestamp with time zone,
    connected_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    category text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    email_notification_status text DEFAULT 'pending'::text NOT NULL,
    email_notification_error text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_inquiries_category_valid CHECK ((category = ANY (ARRAY['general'::text, 'technical'::text, 'billing'::text, 'privacy'::text, 'partnership'::text]))),
    CONSTRAINT support_inquiries_email_length CHECK (((char_length(email) >= 3) AND (char_length(email) <= 200))),
    CONSTRAINT support_inquiries_email_status_valid CHECK ((email_notification_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))),
    CONSTRAINT support_inquiries_message_length CHECK (((char_length(message) >= 10) AND (char_length(message) <= 4000))),
    CONSTRAINT support_inquiries_name_length CHECK (((char_length(name) >= 2) AND (char_length(name) <= 100))),
    CONSTRAINT support_inquiries_status_valid CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text]))),
    CONSTRAINT support_inquiries_subject_length CHECK (((char_length(subject) >= 3) AND (char_length(subject) <= 160)))
);


--
-- Name: team_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_settings (
    organization_id uuid NOT NULL,
    require_approval boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trust_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trust_settings (
    organization_id uuid NOT NULL,
    predictive_guard boolean DEFAULT true NOT NULL,
    last_guard_action_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    platform public.social_platform,
    organization_id uuid,
    social_account_id uuid,
    external_account_id text,
    event_type text DEFAULT 'unknown'::text NOT NULL,
    dedupe_key text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    signature_valid boolean DEFAULT false NOT NULL,
    status public.webhook_status DEFAULT 'received'::public.webhook_status NOT NULL,
    error text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: ai_assistant_usage ai_assistant_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_assistant_usage
    ADD CONSTRAINT ai_assistant_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_daily ai_usage_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_daily
    ADD CONSTRAINT ai_usage_daily_pkey PRIMARY KEY (user_id, day);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: automation_follow_gates automation_follow_gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_follow_gates
    ADD CONSTRAINT automation_follow_gates_pkey PRIMARY KEY (id);


--
-- Name: automation_opt_outs automation_opt_outs_organization_id_platform_external_user__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_opt_outs
    ADD CONSTRAINT automation_opt_outs_organization_id_platform_external_user__key UNIQUE (organization_id, platform, external_user_id);


--
-- Name: automation_opt_outs automation_opt_outs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_opt_outs
    ADD CONSTRAINT automation_opt_outs_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: automation_runs automation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_pkey PRIMARY KEY (id);


--
-- Name: automation_settings automation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_settings
    ADD CONSTRAINT automation_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: blog_categories blog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_pkey PRIMARY KEY (id);


--
-- Name: blog_categories blog_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_slug_key UNIQUE (slug);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: broadcasts broadcasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_pkey PRIMARY KEY (id);


--
-- Name: client_invoices client_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_invoices
    ADD CONSTRAINT client_invoices_pkey PRIMARY KEY (id);


--
-- Name: contact_profiles contact_profiles_organization_id_platform_external_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_profiles
    ADD CONSTRAINT contact_profiles_organization_id_platform_external_user_id_key UNIQUE (organization_id, platform, external_user_id);


--
-- Name: contact_profiles contact_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_profiles
    ADD CONSTRAINT contact_profiles_pkey PRIMARY KEY (id);


--
-- Name: contact_segments contact_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_segments
    ADD CONSTRAINT contact_segments_pkey PRIMARY KEY (id);


--
-- Name: contact_tags contact_tags_organization_id_platform_external_user_id_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_organization_id_platform_external_user_id_tag_key UNIQUE (organization_id, platform, external_user_id, tag);


--
-- Name: contact_tags contact_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_pkey PRIMARY KEY (id);


--
-- Name: conversation_assignments conversation_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_assignments
    ADD CONSTRAINT conversation_assignments_pkey PRIMARY KEY (conversation_id);


--
-- Name: conversation_insights conversation_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_insights
    ADD CONSTRAINT conversation_insights_pkey PRIMARY KEY (id);


--
-- Name: conversation_nudge_log conversation_nudge_log_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_nudge_log
    ADD CONSTRAINT conversation_nudge_log_conversation_id_key UNIQUE (conversation_id);


--
-- Name: conversation_nudge_log conversation_nudge_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_nudge_log
    ADD CONSTRAINT conversation_nudge_log_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_organization_id_platform_external_user_id_cha_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_organization_id_platform_external_user_id_cha_key UNIQUE (organization_id, platform, external_user_id, channel);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: coupon_campaigns coupon_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_campaigns
    ADD CONSTRAINT coupon_campaigns_pkey PRIMARY KEY (id);


--
-- Name: coupon_codes coupon_codes_campaign_id_platform_external_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_codes
    ADD CONSTRAINT coupon_codes_campaign_id_platform_external_user_id_key UNIQUE (campaign_id, platform, external_user_id);


--
-- Name: coupon_codes coupon_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_codes
    ADD CONSTRAINT coupon_codes_code_key UNIQUE (code);


--
-- Name: coupon_codes coupon_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_codes
    ADD CONSTRAINT coupon_codes_pkey PRIMARY KEY (id);


--
-- Name: crm_sync_settings crm_sync_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_sync_settings
    ADD CONSTRAINT crm_sync_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: delivery_pages delivery_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_pages
    ADD CONSTRAINT delivery_pages_pkey PRIMARY KEY (id);


--
-- Name: delivery_pages delivery_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_pages
    ADD CONSTRAINT delivery_pages_slug_key UNIQUE (slug);


--
-- Name: flow_runs flow_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flow_runs
    ADD CONSTRAINT flow_runs_pkey PRIMARY KEY (id);


--
-- Name: growth_competitors growth_competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.growth_competitors
    ADD CONSTRAINT growth_competitors_pkey PRIMARY KEY (id);


--
-- Name: messages messages_conversation_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_external_id_key UNIQUE (conversation_id, external_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: nudge_settings nudge_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nudge_settings
    ADD CONSTRAINT nudge_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: oauth_states oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_pkey PRIMARY KEY (state);


--
-- Name: org_audit_log org_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_audit_log
    ADD CONSTRAINT org_audit_log_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_token_key UNIQUE (token);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: outgoing_webhooks outgoing_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outgoing_webhooks
    ADD CONSTRAINT outgoing_webhooks_pkey PRIMARY KEY (id);


--
-- Name: payment_credentials payment_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_credentials
    ADD CONSTRAINT payment_credentials_pkey PRIMARY KEY (organization_id);


--
-- Name: payment_links payment_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_links
    ADD CONSTRAINT payment_links_pkey PRIMARY KEY (id);


--
-- Name: payment_links payment_links_provider_link_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_links
    ADD CONSTRAINT payment_links_provider_link_id_key UNIQUE (provider_link_id);


--
-- Name: plan_orders plan_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_orders
    ADD CONSTRAINT plan_orders_pkey PRIMARY KEY (id);


--
-- Name: platform_audit_log platform_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_log
    ADD CONSTRAINT platform_audit_log_pkey PRIMARY KEY (id);


--
-- Name: platform_roles platform_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_roles
    ADD CONSTRAINT platform_roles_pkey PRIMARY KEY (id);


--
-- Name: platform_roles platform_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_roles
    ADD CONSTRAINT platform_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: reply_approvals reply_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_approvals
    ADD CONSTRAINT reply_approvals_pkey PRIMARY KEY (id);


--
-- Name: revenue_events revenue_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_events
    ADD CONSTRAINT revenue_events_pkey PRIMARY KEY (id);


--
-- Name: revenue_products revenue_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_products
    ADD CONSTRAINT revenue_products_pkey PRIMARY KEY (id);


--
-- Name: revenue_settings revenue_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_settings
    ADD CONSTRAINT revenue_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: scheduler_heartbeats scheduler_heartbeats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduler_heartbeats
    ADD CONSTRAINT scheduler_heartbeats_pkey PRIMARY KEY (job);


--
-- Name: social_account_tokens social_account_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_account_tokens
    ADD CONSTRAINT social_account_tokens_pkey PRIMARY KEY (social_account_id);


--
-- Name: social_accounts social_accounts_organization_id_platform_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_organization_id_platform_external_id_key UNIQUE (organization_id, platform, external_id);


--
-- Name: social_accounts social_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (id);


--
-- Name: support_inquiries support_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_inquiries
    ADD CONSTRAINT support_inquiries_pkey PRIMARY KEY (id);


--
-- Name: team_settings team_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_settings
    ADD CONSTRAINT team_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: trust_settings trust_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_settings
    ADD CONSTRAINT trust_settings_pkey PRIMARY KEY (organization_id);


--
-- Name: webhook_events webhook_events_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: ai_assistant_usage_user_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_assistant_usage_user_day_idx ON public.ai_assistant_usage USING btree (user_id, created_at DESC);


--
-- Name: automation_follow_gates_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_follow_gates_lookup ON public.automation_follow_gates USING btree (organization_id, platform, external_user_id, status);


--
-- Name: automation_rules_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_rules_org_idx ON public.automation_rules USING btree (organization_id, is_active, priority);


--
-- Name: automation_runs_contact_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_contact_idx ON public.automation_runs USING btree (organization_id, conversation_id, created_at DESC);


--
-- Name: automation_runs_org_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_org_created_idx ON public.automation_runs USING btree (organization_id, created_at DESC);


--
-- Name: automation_runs_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_org_idx ON public.automation_runs USING btree (organization_id, created_at DESC);


--
-- Name: automation_runs_org_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_org_status_created_idx ON public.automation_runs USING btree (organization_id, status, created_at DESC);


--
-- Name: automation_runs_rule_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_rule_day_idx ON public.automation_runs USING btree (rule_id, created_at DESC);


--
-- Name: blog_posts_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blog_posts_published_idx ON public.blog_posts USING btree (status, published_at DESC);


--
-- Name: client_invoices_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_invoices_org_idx ON public.client_invoices USING btree (organization_id, created_at DESC);


--
-- Name: conversation_insights_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_insights_org_idx ON public.conversation_insights USING btree (organization_id, created_at DESC);


--
-- Name: conversations_org_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_org_recent ON public.conversations USING btree (organization_id, last_message_at DESC);


--
-- Name: flow_runs_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flow_runs_due_idx ON public.flow_runs USING btree (status, resume_at);


--
-- Name: growth_competitors_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX growth_competitors_org_idx ON public.growth_competitors USING btree (organization_id);


--
-- Name: messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation ON public.messages USING btree (conversation_id, sent_at);


--
-- Name: messages_conversation_sent_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_sent_at_idx ON public.messages USING btree (conversation_id, sent_at DESC);


--
-- Name: messages_conversation_sent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_sent_idx ON public.messages USING btree (conversation_id, sent_at DESC);


--
-- Name: org_audit_log_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_audit_log_org_idx ON public.org_audit_log USING btree (organization_id, created_at DESC);


--
-- Name: organization_invitations_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organization_invitations_pending_idx ON public.organization_invitations USING btree (organization_id, lower(email)) WHERE (accepted_at IS NULL);


--
-- Name: organization_members_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organization_members_user_idx ON public.organization_members USING btree (user_id);


--
-- Name: organizations_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX organizations_parent_idx ON public.organizations USING btree (parent_organization_id);


--
-- Name: payment_links_nudge_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_links_nudge_idx ON public.payment_links USING btree (status, nudged_at, created_at);


--
-- Name: plan_orders_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_orders_org_idx ON public.plan_orders USING btree (organization_id, created_at DESC);


--
-- Name: platform_audit_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_audit_log_created_at_idx ON public.platform_audit_log USING btree (created_at DESC);


--
-- Name: posts_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_due_idx ON public.posts USING btree (status, scheduled_at) WHERE (status = 'scheduled'::public.post_status);


--
-- Name: posts_group_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_group_id_idx ON public.posts USING btree (group_id);


--
-- Name: posts_org_scheduled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_org_scheduled_idx ON public.posts USING btree (organization_id, scheduled_at DESC);


--
-- Name: reply_approvals_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reply_approvals_org_status ON public.reply_approvals USING btree (organization_id, status, created_at DESC);


--
-- Name: revenue_events_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX revenue_events_org_idx ON public.revenue_events USING btree (organization_id, created_at);


--
-- Name: support_inquiries_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_inquiries_created_at_idx ON public.support_inquiries USING btree (created_at DESC);


--
-- Name: support_inquiries_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_inquiries_status_created_at_idx ON public.support_inquiries USING btree (status, created_at DESC);


--
-- Name: webhook_events_org_received_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_events_org_received_idx ON public.webhook_events USING btree (organization_id, received_at DESC);


--
-- Name: webhook_events_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_events_status_idx ON public.webhook_events USING btree (status);


--
-- Name: automation_rules automation_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER automation_rules_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: automation_settings automation_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER automation_settings_updated_at BEFORE UPDATE ON public.automation_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: blog_posts blog_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: conversations conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: api_keys org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: automation_rules org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: automation_settings org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.automation_settings FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: broadcasts org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.broadcasts FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: client_invoices org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.client_invoices FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: conversation_assignments org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.conversation_assignments FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: coupon_campaigns org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.coupon_campaigns FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: crm_sync_settings org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.crm_sync_settings FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: delivery_pages org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.delivery_pages FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: nudge_settings org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.nudge_settings FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: organization_invitations org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.organization_invitations FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: organization_members org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: outgoing_webhooks org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.outgoing_webhooks FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: payment_credentials org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.payment_credentials FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: reply_approvals org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.reply_approvals FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: revenue_products org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.revenue_products FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: revenue_settings org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.revenue_settings FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: social_accounts org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: team_settings org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.team_settings FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: trust_settings org_audit_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER org_audit_trg AFTER INSERT OR DELETE OR UPDATE ON public.trust_settings FOR EACH ROW EXECUTE FUNCTION public.log_org_audit();


--
-- Name: organizations organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: posts posts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: social_account_tokens social_account_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER social_account_tokens_updated_at BEFORE UPDATE ON public.social_account_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: social_accounts social_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER social_accounts_updated_at BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: support_inquiries support_inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_inquiries_updated_at BEFORE UPDATE ON public.support_inquiries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_usage_daily ai_usage_daily_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_daily
    ADD CONSTRAINT ai_usage_daily_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: automation_follow_gates automation_follow_gates_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_follow_gates
    ADD CONSTRAINT automation_follow_gates_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: automation_follow_gates automation_follow_gates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_follow_gates
    ADD CONSTRAINT automation_follow_gates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: automation_follow_gates automation_follow_gates_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_follow_gates
    ADD CONSTRAINT automation_follow_gates_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE CASCADE;


--
-- Name: automation_follow_gates automation_follow_gates_social_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_follow_gates
    ADD CONSTRAINT automation_follow_gates_social_account_id_fkey FOREIGN KEY (social_account_id) REFERENCES public.social_accounts(id) ON DELETE SET NULL;


--
-- Name: automation_opt_outs automation_opt_outs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_opt_outs
    ADD CONSTRAINT automation_opt_outs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: automation_rules automation_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: automation_rules automation_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: automation_runs automation_runs_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL;


--
-- Name: automation_settings automation_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_settings
    ADD CONSTRAINT automation_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: blog_posts blog_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.blog_categories(id) ON DELETE SET NULL;


--
-- Name: broadcasts broadcasts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcasts
    ADD CONSTRAINT broadcasts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: client_invoices client_invoices_client_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_invoices
    ADD CONSTRAINT client_invoices_client_organization_id_fkey FOREIGN KEY (client_organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: client_invoices client_invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_invoices
    ADD CONSTRAINT client_invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contact_profiles contact_profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_profiles
    ADD CONSTRAINT contact_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contact_segments contact_segments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_segments
    ADD CONSTRAINT contact_segments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contact_tags contact_tags_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_tags
    ADD CONSTRAINT contact_tags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: conversation_assignments conversation_assignments_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_assignments
    ADD CONSTRAINT conversation_assignments_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_assignments conversation_assignments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_assignments
    ADD CONSTRAINT conversation_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: conversation_insights conversation_insights_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_insights
    ADD CONSTRAINT conversation_insights_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_insights conversation_insights_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_insights
    ADD CONSTRAINT conversation_insights_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: conversation_nudge_log conversation_nudge_log_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_nudge_log
    ADD CONSTRAINT conversation_nudge_log_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_nudge_log conversation_nudge_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_nudge_log
    ADD CONSTRAINT conversation_nudge_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_social_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_social_account_id_fkey FOREIGN KEY (social_account_id) REFERENCES public.social_accounts(id) ON DELETE SET NULL;


--
-- Name: coupon_campaigns coupon_campaigns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_campaigns
    ADD CONSTRAINT coupon_campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: coupon_codes coupon_codes_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_codes
    ADD CONSTRAINT coupon_codes_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.coupon_campaigns(id) ON DELETE CASCADE;


--
-- Name: coupon_codes coupon_codes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_codes
    ADD CONSTRAINT coupon_codes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: crm_sync_settings crm_sync_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_sync_settings
    ADD CONSTRAINT crm_sync_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: delivery_pages delivery_pages_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_pages
    ADD CONSTRAINT delivery_pages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: delivery_pages delivery_pages_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_pages
    ADD CONSTRAINT delivery_pages_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.revenue_products(id) ON DELETE SET NULL;


--
-- Name: flow_runs flow_runs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flow_runs
    ADD CONSTRAINT flow_runs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: flow_runs flow_runs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flow_runs
    ADD CONSTRAINT flow_runs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: growth_competitors growth_competitors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.growth_competitors
    ADD CONSTRAINT growth_competitors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES auth.users(id);


--
-- Name: nudge_settings nudge_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nudge_settings
    ADD CONSTRAINT nudge_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: oauth_states oauth_states_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: oauth_states oauth_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_audit_log org_audit_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_audit_log
    ADD CONSTRAINT org_audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_invitations organization_invitations_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id);


--
-- Name: organization_invitations organization_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);


--
-- Name: organization_invitations organization_invitations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_parent_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_parent_organization_id_fkey FOREIGN KEY (parent_organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: outgoing_webhooks outgoing_webhooks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outgoing_webhooks
    ADD CONSTRAINT outgoing_webhooks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_credentials payment_credentials_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_credentials
    ADD CONSTRAINT payment_credentials_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_links payment_links_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_links
    ADD CONSTRAINT payment_links_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_links payment_links_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_links
    ADD CONSTRAINT payment_links_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.revenue_products(id) ON DELETE SET NULL;


--
-- Name: plan_orders plan_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_orders
    ADD CONSTRAINT plan_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: plan_orders plan_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_orders
    ADD CONSTRAINT plan_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: platform_audit_log platform_audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_log
    ADD CONSTRAINT platform_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: platform_roles platform_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_roles
    ADD CONSTRAINT platform_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: posts posts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: posts posts_social_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_social_account_id_fkey FOREIGN KEY (social_account_id) REFERENCES public.social_accounts(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reply_approvals reply_approvals_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_approvals
    ADD CONSTRAINT reply_approvals_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: reply_approvals reply_approvals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_approvals
    ADD CONSTRAINT reply_approvals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: revenue_events revenue_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_events
    ADD CONSTRAINT revenue_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: revenue_products revenue_products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_products
    ADD CONSTRAINT revenue_products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: revenue_settings revenue_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenue_settings
    ADD CONSTRAINT revenue_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: social_account_tokens social_account_tokens_social_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_account_tokens
    ADD CONSTRAINT social_account_tokens_social_account_id_fkey FOREIGN KEY (social_account_id) REFERENCES public.social_accounts(id) ON DELETE CASCADE;


--
-- Name: social_accounts social_accounts_connected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: social_accounts social_accounts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_settings team_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_settings
    ADD CONSTRAINT team_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: trust_settings trust_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_settings
    ADD CONSTRAINT trust_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: webhook_events webhook_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: webhook_events webhook_events_social_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_social_account_id_fkey FOREIGN KEY (social_account_id) REFERENCES public.social_accounts(id) ON DELETE SET NULL;


--
-- Name: contact_profiles Agents edit contact profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agents edit contact profiles" ON public.contact_profiles TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role])) WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role]));


--
-- Name: contact_tags Agents edit contact tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agents edit contact tags" ON public.contact_tags TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role])) WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role]));


--
-- Name: contact_segments Agents edit segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agents edit segments" ON public.contact_segments TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role])) WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role]));


--
-- Name: blog_categories Anyone can read blog categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read blog categories" ON public.blog_categories FOR SELECT TO authenticated, anon USING (true);


--
-- Name: growth_competitors Managers delete competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers delete competitors" ON public.growth_competitors FOR DELETE TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: growth_competitors Managers insert competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers insert competitors" ON public.growth_competitors FOR INSERT TO authenticated WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: org_audit_log Managers read workspace audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers read workspace audit" ON public.org_audit_log FOR SELECT TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: growth_competitors Managers update competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers update competitors" ON public.growth_competitors FOR UPDATE TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: trust_settings Managers update trust settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers update trust settings" ON public.trust_settings FOR UPDATE TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: trust_settings Managers write trust settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers write trust settings" ON public.trust_settings FOR INSERT TO authenticated WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: broadcasts Members manage broadcasts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members manage broadcasts" ON public.broadcasts TO authenticated USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));


--
-- Name: coupon_campaigns Members manage coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members manage coupons" ON public.coupon_campaigns TO authenticated USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));


--
-- Name: nudge_settings Members manage nudge settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members manage nudge settings" ON public.nudge_settings TO authenticated USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));


--
-- Name: delivery_pages Members manage pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members manage pages" ON public.delivery_pages TO authenticated USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));


--
-- Name: revenue_products Members manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members manage products" ON public.revenue_products TO authenticated USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));


--
-- Name: revenue_settings Members manage revenue settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members manage revenue settings" ON public.revenue_settings TO authenticated USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));


--
-- Name: crm_sync_settings Members manage sync settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members manage sync settings" ON public.crm_sync_settings TO authenticated USING (public.current_user_is_org_member(organization_id)) WITH CHECK (public.current_user_is_org_member(organization_id));


--
-- Name: growth_competitors Members read competitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members read competitors" ON public.growth_competitors FOR SELECT TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role, 'viewer'::public.org_role]));


--
-- Name: trust_settings Members read trust settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members read trust settings" ON public.trust_settings FOR SELECT TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role, 'viewer'::public.org_role]));


--
-- Name: contact_profiles Members view contact profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view contact profiles" ON public.contact_profiles FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: contact_tags Members view contact tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view contact tags" ON public.contact_tags FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: coupon_codes Members view coupon codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view coupon codes" ON public.coupon_codes FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: flow_runs Members view flow runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view flow runs" ON public.flow_runs FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: conversation_insights Members view insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view insights" ON public.conversation_insights FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: conversation_nudge_log Members view nudge log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view nudge log" ON public.conversation_nudge_log FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: payment_links Members view payment links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view payment links" ON public.payment_links FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: revenue_events Members view revenue events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view revenue events" ON public.revenue_events FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: contact_segments Members view segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members view segments" ON public.contact_segments FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: webhook_events Org members read webhook events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members read webhook events" ON public.webhook_events FOR SELECT TO authenticated USING ((((organization_id IS NOT NULL) AND app_private.is_org_member(organization_id, auth.uid())) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: blog_posts Public reads published posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads published posts" ON public.blog_posts FOR SELECT TO authenticated, anon USING (((status = ANY (ARRAY['published'::text, 'scheduled'::text])) AND (published_at IS NOT NULL) AND (published_at <= now())));


--
-- Name: client_invoices Reviewers manage client invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviewers manage client invoices" ON public.client_invoices TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])) WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: webhook_events Service role manages webhook events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages webhook events" ON public.webhook_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: support_inquiries Super admins can read support inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can read support inquiries" ON public.support_inquiries FOR SELECT TO authenticated USING (public.current_user_has_platform_role('super_admin'::public.platform_role));


--
-- Name: support_inquiries Super admins can update support inquiries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can update support inquiries" ON public.support_inquiries FOR UPDATE TO authenticated USING (public.current_user_has_platform_role('super_admin'::public.platform_role)) WITH CHECK (public.current_user_has_platform_role('super_admin'::public.platform_role));


--
-- Name: blog_categories Super admins manage blog categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins manage blog categories" ON public.blog_categories TO authenticated USING (public.current_user_has_platform_role('super_admin'::public.platform_role)) WITH CHECK (public.current_user_has_platform_role('super_admin'::public.platform_role));


--
-- Name: blog_posts Super admins manage posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins manage posts" ON public.blog_posts TO authenticated USING (public.current_user_has_platform_role('super_admin'::public.platform_role)) WITH CHECK (public.current_user_has_platform_role('super_admin'::public.platform_role));


--
-- Name: ai_assistant_usage Users read own AI usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own AI usage" ON public.ai_assistant_usage FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: reply_approvals agents request approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "agents request approvals" ON public.reply_approvals FOR INSERT TO authenticated WITH CHECK (((requested_by = auth.uid()) AND (status = 'pending'::text) AND public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role])));


--
-- Name: conversation_assignments agents write assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "agents write assignments" ON public.conversation_assignments TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role])) WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role, 'agent'::public.org_role]));


--
-- Name: ai_assistant_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_assistant_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_rules automation rules delete admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation rules delete admin" ON public.automation_rules FOR DELETE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role]));


--
-- Name: automation_rules automation rules insert manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation rules insert manager" ON public.automation_rules FOR INSERT TO authenticated WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: automation_rules automation rules select member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation rules select member" ON public.automation_rules FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: automation_rules automation rules update manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation rules update manager" ON public.automation_rules FOR UPDATE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])) WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: automation_runs automation runs select member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation runs select member" ON public.automation_runs FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: automation_runs automation runs service role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation runs service role" ON public.automation_runs TO service_role USING (true) WITH CHECK (true);


--
-- Name: automation_settings automation settings insert manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation settings insert manager" ON public.automation_settings FOR INSERT TO authenticated WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: automation_settings automation settings select member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation settings select member" ON public.automation_settings FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: automation_settings automation settings update manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "automation settings update manager" ON public.automation_settings FOR UPDATE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])) WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: automation_follow_gates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_follow_gates ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_opt_outs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_opt_outs ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: broadcasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

--
-- Name: client_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_nudge_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_nudge_log ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations insert member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "conversations insert member" ON public.conversations FOR INSERT TO authenticated WITH CHECK (app_private.is_org_member(organization_id, auth.uid()));


--
-- Name: conversations conversations select member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "conversations select member" ON public.conversations FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: conversations conversations update member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "conversations update member" ON public.conversations FOR UPDATE TO authenticated USING (app_private.is_org_member(organization_id, auth.uid())) WITH CHECK (app_private.is_org_member(organization_id, auth.uid()));


--
-- Name: coupon_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupon_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_sync_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crm_sync_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.flow_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: growth_competitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.growth_competitors ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_invitations invites delete managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invites delete managers" ON public.organization_invitations FOR DELETE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role]));


--
-- Name: organization_invitations invites insert managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invites insert managers" ON public.organization_invitations FOR INSERT TO authenticated WITH CHECK (((role <> 'owner'::public.org_role) AND app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role])));


--
-- Name: organization_invitations invites select members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invites select members" ON public.organization_invitations FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: organization_invitations invites update managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "invites update managers" ON public.organization_invitations FOR UPDATE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role]));


--
-- Name: reply_approvals managers review approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers review approvals" ON public.reply_approvals FOR UPDATE TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])) WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: team_settings managers write team settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers write team settings" ON public.team_settings TO authenticated USING (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])) WITH CHECK (public.current_user_has_org_role(organization_id, ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: organization_members members delete admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members delete admin" ON public.organization_members FOR DELETE TO authenticated USING ((app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role]) OR (user_id = auth.uid())));


--
-- Name: organization_members members insert admin or self-bootstrap; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members insert admin or self-bootstrap" ON public.organization_members FOR INSERT TO authenticated WITH CHECK ((((role <> 'owner'::public.org_role) AND app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role])) OR (EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.owner_id = auth.uid()))))));


--
-- Name: reply_approvals members read approvals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read approvals" ON public.reply_approvals FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: conversation_assignments members read assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read assignments" ON public.conversation_assignments FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: automation_follow_gates members read follow gates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read follow gates" ON public.automation_follow_gates FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: plan_orders members read own org orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read own org orders" ON public.plan_orders FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: team_settings members read team settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read team settings" ON public.team_settings FOR SELECT TO authenticated USING (public.current_user_is_org_member(organization_id));


--
-- Name: organization_members members select same org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members select same org" ON public.organization_members FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: organization_members members update admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members update admin" ON public.organization_members FOR UPDATE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role])) WITH CHECK ((((role <> 'owner'::public.org_role) AND app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role])) OR (EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.owner_id = auth.uid()))))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages insert member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages insert member" ON public.messages FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND app_private.is_org_member(c.organization_id, auth.uid())))));


--
-- Name: messages messages select member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "messages select member" ON public.messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND (app_private.is_org_member(c.organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role))))));


--
-- Name: nudge_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nudge_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_opt_outs opt outs delete manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "opt outs delete manager" ON public.automation_opt_outs FOR DELETE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: automation_opt_outs opt outs insert manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "opt outs insert manager" ON public.automation_opt_outs FOR INSERT TO authenticated WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: automation_opt_outs opt outs select member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "opt outs select member" ON public.automation_opt_outs FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: org_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations orgs delete owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orgs delete owner" ON public.organizations FOR DELETE TO authenticated USING ((owner_id = auth.uid()));


--
-- Name: organizations orgs insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orgs insert own" ON public.organizations FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid()));


--
-- Name: organizations orgs select member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orgs select member" ON public.organizations FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR app_private.is_org_member(id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: organizations orgs update admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orgs update admin" ON public.organizations FOR UPDATE TO authenticated USING (app_private.has_org_role(id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role])) WITH CHECK (app_private.has_org_role(id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role]));


--
-- Name: outgoing_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outgoing_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_roles platform roles select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "platform roles select own" ON public.platform_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: platform_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: posts posts delete managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "posts delete managers" ON public.posts FOR DELETE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: posts posts insert managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "posts insert managers" ON public.posts FOR INSERT TO authenticated WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: posts posts select members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "posts select members" ON public.posts FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: posts posts update managers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "posts update managers" ON public.posts FOR UPDATE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])) WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles select own" ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: profiles profiles select teammates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles select teammates" ON public.profiles FOR SELECT TO authenticated USING (app_private.shares_org(auth.uid(), id));


--
-- Name: profiles profiles update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: reply_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reply_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: revenue_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

--
-- Name: revenue_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.revenue_products ENABLE ROW LEVEL SECURITY;

--
-- Name: revenue_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.revenue_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduler_heartbeats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduler_heartbeats ENABLE ROW LEVEL SECURITY;

--
-- Name: social_accounts social accounts delete admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "social accounts delete admin" ON public.social_accounts FOR DELETE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role]));


--
-- Name: social_accounts social accounts insert manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "social accounts insert manager" ON public.social_accounts FOR INSERT TO authenticated WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: social_accounts social accounts select member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "social accounts select member" ON public.social_accounts FOR SELECT TO authenticated USING ((app_private.is_org_member(organization_id, auth.uid()) OR app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role)));


--
-- Name: social_accounts social accounts update manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "social accounts update manager" ON public.social_accounts FOR UPDATE TO authenticated USING (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role])) WITH CHECK (app_private.has_org_role(organization_id, auth.uid(), ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'manager'::public.org_role]));


--
-- Name: social_account_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_account_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: social_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_audit_log super admins read audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admins read audit log" ON public.platform_audit_log FOR SELECT TO authenticated USING (app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role));


--
-- Name: platform_settings super admins read platform settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "super admins read platform settings" ON public.platform_settings FOR SELECT TO authenticated USING (app_private.has_platform_role(auth.uid(), 'super_admin'::public.platform_role));


--
-- Name: support_inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: team_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: trust_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trust_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA app_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION has_org_role(_org_id uuid, _user_id uuid, _roles public.org_role[]); Type: ACL; Schema: app_private; Owner: -
--

GRANT ALL ON FUNCTION app_private.has_org_role(_org_id uuid, _user_id uuid, _roles public.org_role[]) TO authenticated;
GRANT ALL ON FUNCTION app_private.has_org_role(_org_id uuid, _user_id uuid, _roles public.org_role[]) TO service_role;


--
-- Name: FUNCTION has_platform_role(_user_id uuid, _role public.platform_role); Type: ACL; Schema: app_private; Owner: -
--

GRANT ALL ON FUNCTION app_private.has_platform_role(_user_id uuid, _role public.platform_role) TO authenticated;
GRANT ALL ON FUNCTION app_private.has_platform_role(_user_id uuid, _role public.platform_role) TO service_role;


--
-- Name: FUNCTION is_org_member(_org_id uuid, _user_id uuid); Type: ACL; Schema: app_private; Owner: -
--

GRANT ALL ON FUNCTION app_private.is_org_member(_org_id uuid, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION app_private.is_org_member(_org_id uuid, _user_id uuid) TO service_role;


--
-- Name: FUNCTION shares_org(_a uuid, _b uuid); Type: ACL; Schema: app_private; Owner: -
--

GRANT ALL ON FUNCTION app_private.shares_org(_a uuid, _b uuid) TO authenticated;
GRANT ALL ON FUNCTION app_private.shares_org(_a uuid, _b uuid) TO service_role;


--
-- Name: FUNCTION consume_ai_request(_user_id uuid, _limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.consume_ai_request(_user_id uuid, _limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.consume_ai_request(_user_id uuid, _limit integer) TO service_role;


--
-- Name: FUNCTION current_user_has_org_role(_org_id uuid, _roles public.org_role[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_has_org_role(_org_id uuid, _roles public.org_role[]) TO anon;
GRANT ALL ON FUNCTION public.current_user_has_org_role(_org_id uuid, _roles public.org_role[]) TO authenticated;
GRANT ALL ON FUNCTION public.current_user_has_org_role(_org_id uuid, _roles public.org_role[]) TO service_role;


--
-- Name: FUNCTION current_user_has_platform_role(_role public.platform_role); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_has_platform_role(_role public.platform_role) TO anon;
GRANT ALL ON FUNCTION public.current_user_has_platform_role(_role public.platform_role) TO authenticated;
GRANT ALL ON FUNCTION public.current_user_has_platform_role(_role public.platform_role) TO service_role;


--
-- Name: FUNCTION current_user_is_org_member(_org_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_is_org_member(_org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.current_user_is_org_member(_org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.current_user_is_org_member(_org_id uuid) TO service_role;


--
-- Name: FUNCTION increment_unread(p_conversation_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_unread(p_conversation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_unread(p_conversation_id uuid) TO service_role;


--
-- Name: FUNCTION log_org_audit(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_org_audit() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_org_audit() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: TABLE ai_assistant_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_assistant_usage TO anon;
GRANT ALL ON TABLE public.ai_assistant_usage TO authenticated;
GRANT ALL ON TABLE public.ai_assistant_usage TO service_role;


--
-- Name: TABLE ai_usage_daily; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_usage_daily TO anon;
GRANT ALL ON TABLE public.ai_usage_daily TO authenticated;
GRANT ALL ON TABLE public.ai_usage_daily TO service_role;


--
-- Name: TABLE api_keys; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.api_keys TO anon;
GRANT ALL ON TABLE public.api_keys TO authenticated;
GRANT ALL ON TABLE public.api_keys TO service_role;


--
-- Name: TABLE automation_follow_gates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_follow_gates TO anon;
GRANT ALL ON TABLE public.automation_follow_gates TO authenticated;
GRANT ALL ON TABLE public.automation_follow_gates TO service_role;


--
-- Name: TABLE automation_opt_outs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_opt_outs TO anon;
GRANT ALL ON TABLE public.automation_opt_outs TO authenticated;
GRANT ALL ON TABLE public.automation_opt_outs TO service_role;


--
-- Name: TABLE automation_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_rules TO anon;
GRANT ALL ON TABLE public.automation_rules TO authenticated;
GRANT ALL ON TABLE public.automation_rules TO service_role;


--
-- Name: TABLE automation_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_runs TO anon;
GRANT ALL ON TABLE public.automation_runs TO authenticated;
GRANT ALL ON TABLE public.automation_runs TO service_role;


--
-- Name: TABLE automation_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_settings TO anon;
GRANT ALL ON TABLE public.automation_settings TO authenticated;
GRANT ALL ON TABLE public.automation_settings TO service_role;


--
-- Name: TABLE blog_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.blog_categories TO anon;
GRANT ALL ON TABLE public.blog_categories TO authenticated;
GRANT ALL ON TABLE public.blog_categories TO service_role;


--
-- Name: TABLE blog_posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.blog_posts TO anon;
GRANT ALL ON TABLE public.blog_posts TO authenticated;
GRANT ALL ON TABLE public.blog_posts TO service_role;


--
-- Name: TABLE broadcasts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.broadcasts TO anon;
GRANT ALL ON TABLE public.broadcasts TO authenticated;
GRANT ALL ON TABLE public.broadcasts TO service_role;


--
-- Name: TABLE client_invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.client_invoices TO anon;
GRANT ALL ON TABLE public.client_invoices TO authenticated;
GRANT ALL ON TABLE public.client_invoices TO service_role;


--
-- Name: TABLE contact_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_profiles TO anon;
GRANT ALL ON TABLE public.contact_profiles TO authenticated;
GRANT ALL ON TABLE public.contact_profiles TO service_role;


--
-- Name: TABLE contact_segments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_segments TO anon;
GRANT ALL ON TABLE public.contact_segments TO authenticated;
GRANT ALL ON TABLE public.contact_segments TO service_role;


--
-- Name: TABLE contact_tags; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.contact_tags TO anon;
GRANT ALL ON TABLE public.contact_tags TO authenticated;
GRANT ALL ON TABLE public.contact_tags TO service_role;


--
-- Name: TABLE conversation_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_assignments TO anon;
GRANT ALL ON TABLE public.conversation_assignments TO authenticated;
GRANT ALL ON TABLE public.conversation_assignments TO service_role;


--
-- Name: TABLE conversation_insights; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_insights TO anon;
GRANT ALL ON TABLE public.conversation_insights TO authenticated;
GRANT ALL ON TABLE public.conversation_insights TO service_role;


--
-- Name: TABLE conversation_nudge_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_nudge_log TO anon;
GRANT ALL ON TABLE public.conversation_nudge_log TO authenticated;
GRANT ALL ON TABLE public.conversation_nudge_log TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE coupon_campaigns; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.coupon_campaigns TO anon;
GRANT ALL ON TABLE public.coupon_campaigns TO authenticated;
GRANT ALL ON TABLE public.coupon_campaigns TO service_role;


--
-- Name: TABLE coupon_codes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.coupon_codes TO anon;
GRANT ALL ON TABLE public.coupon_codes TO authenticated;
GRANT ALL ON TABLE public.coupon_codes TO service_role;


--
-- Name: TABLE crm_sync_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.crm_sync_settings TO anon;
GRANT ALL ON TABLE public.crm_sync_settings TO authenticated;
GRANT ALL ON TABLE public.crm_sync_settings TO service_role;


--
-- Name: TABLE delivery_pages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.delivery_pages TO anon;
GRANT ALL ON TABLE public.delivery_pages TO authenticated;
GRANT ALL ON TABLE public.delivery_pages TO service_role;


--
-- Name: TABLE flow_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.flow_runs TO anon;
GRANT ALL ON TABLE public.flow_runs TO authenticated;
GRANT ALL ON TABLE public.flow_runs TO service_role;


--
-- Name: TABLE growth_competitors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.growth_competitors TO anon;
GRANT ALL ON TABLE public.growth_competitors TO authenticated;
GRANT ALL ON TABLE public.growth_competitors TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE nudge_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.nudge_settings TO anon;
GRANT ALL ON TABLE public.nudge_settings TO authenticated;
GRANT ALL ON TABLE public.nudge_settings TO service_role;


--
-- Name: TABLE oauth_states; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.oauth_states TO anon;
GRANT ALL ON TABLE public.oauth_states TO authenticated;
GRANT ALL ON TABLE public.oauth_states TO service_role;


--
-- Name: TABLE org_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_audit_log TO anon;
GRANT ALL ON TABLE public.org_audit_log TO authenticated;
GRANT ALL ON TABLE public.org_audit_log TO service_role;


--
-- Name: TABLE organization_invitations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organization_invitations TO anon;
GRANT ALL ON TABLE public.organization_invitations TO authenticated;
GRANT ALL ON TABLE public.organization_invitations TO service_role;


--
-- Name: TABLE organization_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organization_members TO anon;
GRANT ALL ON TABLE public.organization_members TO authenticated;
GRANT ALL ON TABLE public.organization_members TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: TABLE outgoing_webhooks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.outgoing_webhooks TO anon;
GRANT ALL ON TABLE public.outgoing_webhooks TO authenticated;
GRANT ALL ON TABLE public.outgoing_webhooks TO service_role;


--
-- Name: TABLE payment_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_credentials TO anon;
GRANT ALL ON TABLE public.payment_credentials TO authenticated;
GRANT ALL ON TABLE public.payment_credentials TO service_role;


--
-- Name: TABLE payment_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_links TO anon;
GRANT ALL ON TABLE public.payment_links TO authenticated;
GRANT ALL ON TABLE public.payment_links TO service_role;


--
-- Name: TABLE plan_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_orders TO anon;
GRANT ALL ON TABLE public.plan_orders TO authenticated;
GRANT ALL ON TABLE public.plan_orders TO service_role;


--
-- Name: TABLE platform_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_audit_log TO anon;
GRANT ALL ON TABLE public.platform_audit_log TO authenticated;
GRANT ALL ON TABLE public.platform_audit_log TO service_role;


--
-- Name: TABLE platform_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_roles TO anon;
GRANT ALL ON TABLE public.platform_roles TO authenticated;
GRANT ALL ON TABLE public.platform_roles TO service_role;


--
-- Name: TABLE platform_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_settings TO anon;
GRANT ALL ON TABLE public.platform_settings TO authenticated;
GRANT ALL ON TABLE public.platform_settings TO service_role;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.posts TO anon;
GRANT ALL ON TABLE public.posts TO authenticated;
GRANT ALL ON TABLE public.posts TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE reply_approvals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reply_approvals TO anon;
GRANT ALL ON TABLE public.reply_approvals TO authenticated;
GRANT ALL ON TABLE public.reply_approvals TO service_role;


--
-- Name: TABLE revenue_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.revenue_events TO anon;
GRANT ALL ON TABLE public.revenue_events TO authenticated;
GRANT ALL ON TABLE public.revenue_events TO service_role;


--
-- Name: TABLE revenue_products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.revenue_products TO anon;
GRANT ALL ON TABLE public.revenue_products TO authenticated;
GRANT ALL ON TABLE public.revenue_products TO service_role;


--
-- Name: TABLE revenue_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.revenue_settings TO anon;
GRANT ALL ON TABLE public.revenue_settings TO authenticated;
GRANT ALL ON TABLE public.revenue_settings TO service_role;


--
-- Name: TABLE scheduler_heartbeats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.scheduler_heartbeats TO service_role;


--
-- Name: TABLE social_account_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.social_account_tokens TO anon;
GRANT ALL ON TABLE public.social_account_tokens TO authenticated;
GRANT ALL ON TABLE public.social_account_tokens TO service_role;


--
-- Name: TABLE social_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.social_accounts TO anon;
GRANT ALL ON TABLE public.social_accounts TO authenticated;
GRANT ALL ON TABLE public.social_accounts TO service_role;


--
-- Name: TABLE support_inquiries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.support_inquiries TO anon;
GRANT ALL ON TABLE public.support_inquiries TO authenticated;
GRANT ALL ON TABLE public.support_inquiries TO service_role;


--
-- Name: TABLE team_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_settings TO anon;
GRANT ALL ON TABLE public.team_settings TO authenticated;
GRANT ALL ON TABLE public.team_settings TO service_role;


--
-- Name: TABLE trust_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trust_settings TO anon;
GRANT ALL ON TABLE public.trust_settings TO authenticated;
GRANT ALL ON TABLE public.trust_settings TO service_role;


--
-- Name: TABLE webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.webhook_events TO anon;
GRANT ALL ON TABLE public.webhook_events TO authenticated;
GRANT ALL ON TABLE public.webhook_events TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--



-- ---------------- Storage bucket for post media (private) ----------------
insert into storage.buckets (id, name, public) values ('post-media','post-media', false)
on conflict (id) do nothing;
create policy "post media members read" on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and app_private.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "post media writers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and app_private.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), array['owner'::public.org_role,'admin'::public.org_role,'manager'::public.org_role]));
create policy "post media writers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and app_private.has_org_role(((storage.foldername(name))[1])::uuid, auth.uid(), array['owner'::public.org_role,'admin'::public.org_role,'manager'::public.org_role]));

-- ---------------- Platform settings row (required — features stay hidden without it) ----------------
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

-- Tell the self-hosted migration runner these are already applied
create table if not exists public._app_migrations (name text primary key, applied_at timestamptz not null default now());

# SEO/GEO platform, Blog CMS and tracking settings

## Goal
Make the public website easy to find on Google, Bing and AI search tools (ChatGPT, Perplexity, Gemini). Add a blog that super admins manage like WordPress + Rank Math, with AI help. Add one settings page for GA4, Search Console, AdSense, Tag Manager, Meta Pixel and Bing verification. Do not touch Instagram, Facebook or YouTube automation, the Meta webhook, or any page the Meta reviewer uses.

## Phase 1 — Site-wide SEO and GEO basics
- Each public page gets a unique title, description, canonical URL, Open Graph and Twitter tags, using `https://autodm.techaasvik.com`.
- Structured data (JSON-LD): Organization, WebSite, SoftwareApplication with pricing, FAQPage on the home page, BreadcrumbList on deeper pages, and BlogPosting on articles.
- `sitemap.xml` built automatically from public pages and published posts, plus `robots.txt` that links to the sitemap and blocks `/admin`, `/dashboard` and `/api`.
- `llms.txt` and an RSS feed so AI search tools can read and cite the content.
- Image alt text, a single H1 per page, clean heading order, and lazy-loaded images.

## Phase 2 — Public blog
- `/blog`: list of posts with category and tag filters, search and pagination.
- `/blog/$slug`: the article, with table of contents, author box, reading time, FAQ block, related posts, a sign-up call-to-action ("Start free for ₹9") and share buttons.
- `/blog/category/$slug` and `/blog/tag/$slug` archive pages.
- A Blog link in the header and footer.

## Phase 3 — Blog admin (Super admin → Blog)
- Posts list: draft, scheduled and published, with search, filters, and duplicate/delete actions.
- Editor: rich text (headings, lists, links, images, tables, quotes, code), cover image upload, slug, excerpt, category, tags, author, publish now or schedule.
- Rank Math-style sidebar:
  - focus keyword plus extra keywords
  - SEO title and meta description, with a live Google preview and length meters
  - 0–100 score with a checklist: keyword in title, URL, first paragraph and headings; keyword density; length; internal and external links; image alt text; readability
  - GEO score: direct-answer summary, FAQ section, statistics or sources, clear definitions, entity mentions
  - canonical, noindex, social image, and schema type (Article, HowTo or FAQ)
- Manage categories, tags and authors.
- 301 redirects manager for changed slugs.

## Phase 4 — AI assistant for blogs
Uses the existing AI provider failover (OpenRouter, NVIDIA, OpenAI, Lovable AI):
- topic and keyword ideas around DM automation (Instagram comment to DM, auto reply, ManyChat alternative India, etc.)
- outline and full draft generation
- "Improve score" rewrites the title, meta, headings and FAQ to fix failing checks
- a GEO "answer box" summary and FAQ generator
- internal link suggestions to other posts and product pages

All AI calls run on the server, are limited to super admins, and have a usage cap per hour.

## Phase 5 — Starter content
- 8–10 draft articles aimed at high-intent searches (comment to DM automation, Instagram auto DM for Indian creators, a ManyChat alternative in India, Facebook comment auto reply, YouTube AI comment replies, follow-gate guide, and pricing comparisons).
- They are saved as drafts for you to review before publishing. Facts are not invented.

## Phase 6 — Tracking and verification settings (Super admin → SEO & Tracking)
- Fields: GA4 Measurement ID, Google Tag Manager ID, AdSense publisher ID (plus `ads.txt`), Meta Pixel ID, Google Search Console verification code, Bing verification code, and an optional custom head snippet.
- Each field is checked for the right format. Scripts load only on public pages, never inside the dashboard, the admin panel or the login flow.
- The verification meta tags are written into the page so Google and Bing can confirm ownership. A "Check" button fetches the live page and confirms each tag is present.
- A cookie consent banner. Analytics, ads and Pixel scripts load only after the visitor agrees.

## Safety
- No changes to automation, webhooks, messaging, OAuth, billing logic or existing tests.
- Blog tables are locked down: the public can read published posts only, and only super admins can write.
- The 43 regression tests must keep passing. After the build, push to GitHub and check the Railway deploy.

## Honest note on ranking
Good structure, schema and content make ranking possible, but no tool can guarantee the top spot. Results depend on regular publishing, backlinks and time, usually 3–6 months.

## Technical details
- New tables: `blog_posts`, `blog_categories`, `blog_tags`, `blog_post_tags`, `blog_redirects`, `site_seo_settings`. Each gets GRANTs, RLS and `has_platform_role` checks.
- New storage bucket `blog-media` that anyone can read; only super admins can upload.
- Server functions in `src/lib/blog.functions.ts` and `src/lib/seo-settings.functions.ts`. Server routes for `sitemap.xml`, `rss.xml`, `llms.txt` and `ads.txt`.
- Tracking tags are injected in `__root` head only on public routes, from the cached public settings.
- Editor: TipTap. SEO scoring is a pure function, unit-tested.

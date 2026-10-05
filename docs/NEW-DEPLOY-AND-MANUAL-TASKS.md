# AutoDM — Naya Railway project + naya Supabase database: deploy guide + manual kaam

Ye guide tab ke liye hai jab aap **bilkul naya** Supabase project aur **naya** Railway project bana rahe ho.
Production address: `https://autodm.techaasvik.com`

> Dhyan do: naya database **khaali** hoga. Purane users, connected accounts, rules, contacts kuch bhi apne aap nahi aayega. Sabko dobara sign up + accounts dobara connect karne honge.

---

## Part A — Supabase (naya database)

### A1. Project banao
1. supabase.com → **New project** → Region **Southeast Asia (Singapore)**.
2. Strong **Database password** banao aur safe jagah save karo.

### A2. Poora database ek baar mein banao
1. Supabase → **SQL Editor** → New query.
2. Repo ki file **`docs/sql/fresh-database.sql`** poori copy karke paste karo → **Run**.
   - Isse 52 tables, saari security rules (RLS), functions, triggers, `post-media` storage bucket aur zaroori settings row ban jaati hai.
3. Sirf **ek baar** chalana. Error aaye to poora error screenshot bhejo — dobara mat chalao.
4. Check: Table Editor mein `organizations`, `automation_rules`, `platform_settings` dikhne chahiye; `platform_settings` mein 1 row honi chahiye.

### A3. Values copy karo (Settings → API / Database)
| Supabase | Railway variable |
|---|---|
| Project URL | `VITE_SUPABASE_URL`, `SUPABASE_URL` |
| Publishable / anon key | `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` |
| Secret / service_role key | `SUPABASE_SERVICE_ROLE_KEY` (kabhi share mat karo) |
| Project ref | `VITE_SUPABASE_PROJECT_ID` |
| `https://<ref>.supabase.co/auth/v1` | `SUPABASE_JWT_ISSUER` |
| Connection string → **Session pooler** URI (password daal ke) | `DATABASE_URL` |

### A4. Login settings (Authentication)
- **URL Configuration** → Site URL: `https://autodm.techaasvik.com`; Redirect URLs: `https://autodm.techaasvik.com/**` aur `https://<railway-app>.up.railway.app/**`.
- **Providers → Email**: Confirm email **ON**.
- (Optional) Google login: provider ON + Google client ID/secret; Google console mein redirect `https://<ref>.supabase.co/auth/v1/callback`.
- **SMTP** (Settings → Auth → SMTP): apna email sender (Resend/Zoho) lagao, warna Supabase ka free mailer 2–3 mail/hour hi bhejta hai.

### A5. Super admin banao (deploy ke baad)
App par `/auth` se apne email se sign up → mail confirm → phir SQL Editor:
```sql
insert into public.platform_roles (user_id, role)
select id, 'super_admin'::platform_role from auth.users
where lower(email) = 'contact@techaasvik.com'
on conflict do nothing;
```

---

## Part B — Railway (naya project)

### B1. Service banao
1. Railway → New Project → **Deploy from GitHub repo** → `Vikashkumar2750/remix-of-dm-automation-v3` → branch `main`.
2. `railway.json` + `Dockerfile` apne aap use honge (scheduler bhi same service mein chalta hai — alag cron job nahi chahiye).

### B2. Variables (Service → Variables)
**Zaroori (inke bina app nahi chalega):**
```
VITE_SUPABASE_URL  VITE_SUPABASE_PUBLISHABLE_KEY  VITE_SUPABASE_PROJECT_ID
SUPABASE_URL  SUPABASE_PUBLISHABLE_KEY  SUPABASE_SERVICE_ROLE_KEY  SUPABASE_JWT_ISSUER
DATABASE_URL
PUBLIC_APP_URL=https://autodm.techaasvik.com
CRON_SECRET=<lamba random text>
TOKEN_ENCRYPTION_KEY=<neeche B3 dekho>
NODE_ENV=production  NITRO_PRESET=node-server  PORT=3000
```
**Meta (Instagram + Facebook):**
```
META_APP_ID  META_APP_SECRET  META_WEBHOOK_VERIFY_TOKEN
INSTAGRAM_APP_SECRET   (Instagram app ID 1497788405165320 ka secret)
```
**YouTube:** `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
**Plans payment:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys = demo mode)
**AI (kam se kam ek):** `LOVABLE_API_KEY` ya `OPENROUTER_API_KEY` / `OPENROUTER_API_KEYS` / `NVIDIA_API_KEY` / `OPENAI_API_KEY` (ye Super Admin → AI providers se bhi daal sakte ho)
**Support email alerts (optional):** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

`VITE_*` teeno build ke time bhi chahiye — Railway khud pass karta hai, bas Variables mein hone chahiye.

### B3. TOKEN_ENCRYPTION_KEY banao (naye DB par shuru se lagao — sabse aasaan time yahi hai)
Apne computer par:
```
openssl rand -base64 32
```
Output Railway variable `TOKEN_ENCRYPTION_KEY` mein daalo. **Is key ko safe rakho** — badla ya kho gaya to saare connected accounts dobara connect karne padenge.

### B4. Custom domain
1. Railway → Service → Settings → Networking → **Custom domain** → `autodm.techaasvik.com`.
2. Domain DNS mein Railway ka diya **CNAME** record (`autodm` → `xxxx.up.railway.app`) daalo.
3. SSL green hone tak wait (5–30 min). Purane Railway project se domain pehle hatao.

### B5. Deploy check
Logs mein `[migrate]` line aur server start dikhna chahiye. Phir browser mein `/`, `/auth`, `/privacy` khulne chahiye.

---

## Part C — External dashboards (URLs naye deploy ke hisaab se)

**Meta (developers.facebook.com):**
- Facebook Login for Business → Valid OAuth Redirect URI: `https://autodm.techaasvik.com/api/public/oauth/meta/callback`
- Instagram login → redirect: same callback
- Webhooks (Page + Instagram): callback `https://autodm.techaasvik.com/api/public/webhooks/meta`, verify token = `META_WEBHOOK_VERIFY_TOKEN` → **Verify and save** (naye server par dobara verify karna zaroori)
- App Domains `autodm.techaasvik.com`; Privacy `/privacy`, Terms `/terms`, Data deletion `/data-deletion`

**Google Cloud (YouTube):** JS origin `https://autodm.techaasvik.com`; redirect `https://autodm.techaasvik.com/api/public/oauth/google/callback`

**Razorpay (har workspace owner khud):** webhook `https://autodm.techaasvik.com/api/public/webhooks/razorpay/<workspace-id>` — Revenue page par exact address dikhta hai. Naye DB mein workspace ID nayi hogi, isliye purana webhook update karna padega.

---

## Part D — Deploy ke baad app ke andar (Super Admin)
1. Super admin se login → `/admin`.
2. **Plans** → prices + DM/rule limits check karo.
3. **System settings** → feature switches (flows, AI agent, entry points) check karo; test console default off.
4. **AI providers** → keys daalo; daily AI limit (default 5/user).
5. **Site settings** → GA4 / GTM / Search Console / Pixel IDs dobara daalo (naye DB mein khaali honge).
6. **Blog** → purane posts naye DB mein nahi aayenge; zaroori ho to dobara banao.
7. Test accounts dobara banao (reviewer ke liye bhi) aur reviewer workspace ko Pro plan do.

---

## Part E — Manual kaam jo abhi baaki hai (sirf aap kar sakte ho)

| # | Kaam | Kyun main nahi kar sakta |
|---|---|---|
| 1 | Supabase project + `fresh-database.sql` run | Aapke Supabase account ka kaam |
| 2 | Railway variables, domain CNAME | Aapke Railway/DNS account |
| 3 | `TOKEN_ENCRYPTION_KEY` generate + save | Secret sirf aapke paas rehna chahiye |
| 4 | `INSTAGRAM_APP_SECRET` Railway mein | Meta dashboard se copy |
| 5 | Meta webhook dobara **Verify and save** + OAuth URLs | Meta dashboard |
| 6 | Meta App Review: Human Agent remove, form answers (`docs/META-APP-REVIEW-SUBMISSION.md` 0.6) | Meta dashboard |
| 7 | Live test: test IG/FB par comment → DM → button → link; follower + non-follower dono | Asli account tap chahiye |
| 8 | Story reply, ice breaker "Sync to Meta" live test | Asli account |
| 9 | Razorpay live keys + ek ₹1 asli payment test | Aapka Razorpay account |
| 10 | YouTube: Google verification (`docs/GOOGLE-YOUTUBE-VERIFICATION.md`) | Google review |
| 11 | App Review approve hone ke baad `meta_async_webhook` ON karke step 7 dobara | Approval ke baad hi |
| 12 | SMTP email sender (password reset mails ke liye) | Aapka email account |
| 13 | Purana Railway project + purana domain band karna | Aapka account |

---

## Part F — Final checklist
- [ ] `/`, `/auth`, `/privacy`, `/terms`, `/data-deletion` khul rahe hain
- [ ] Sign up + confirmation email aa raha hai
- [ ] Login ke baad `/dashboard` par workspace bana
- [ ] Super admin ko `/admin` mila
- [ ] Instagram + Facebook connect hue (Social accounts)
- [ ] Meta webhook "Verified" dikh raha hai
- [ ] Ek comment → DM aaya (Automations → Activity mein "sent")
- [ ] Create post mein image upload ho rahi hai
- [ ] Scheduler chal raha hai (Admin → Health mein heartbeat green)

# Apna Supabase project banana (free) — step by step

Ye app database, login aur file storage ke liye Supabase use karta hai. Neeche
ke steps ~10 minute lete hain aur free plan par poori tarah chalte hain.

---

## 1. Project banayein

1. https://supabase.com par jayein → **Start your project** → GitHub/Google se sign up.
2. **New project** → Organization chunein.
3. Bharें:
   - **Name**: `contentengineer` (koi bhi naam)
   - **Database Password**: strong password banayein aur **kahin safe jagah note kar lein**
     (ye baad me dobara nahi dikhta, DATABASE_URL me chahiye hoga)
   - **Region**: `Southeast Asia (Singapore)` — India ke liye sabse tez
4. **Create new project** → 2–3 minute wait.

---

## 2. Teen values copy karein (API keys)

Project me **Settings → API**:

| Supabase par                  | Railway variable name                                       |
| ----------------------------- | ----------------------------------------------------------- |
| Project URL                   | `VITE_SUPABASE_URL` aur `SUPABASE_URL`                       |
| `anon` / publishable key      | `VITE_SUPABASE_PUBLISHABLE_KEY` aur `SUPABASE_PUBLISHABLE_KEY` |
| `service_role` / secret key   | `SUPABASE_SERVICE_ROLE_KEY`                                  |
| Project ref (URL ka pehla hissa, e.g. `abcd1234`) | `VITE_SUPABASE_PROJECT_ID`              |

> `service_role` key sirf server par jati hai. Kabhi kisi ko na bhejein, browser
> me na daalein.

---

## 3. DATABASE_URL lein

**Settings → Database → Connection string → URI** (mode: **Session pooler**).

Wo aisa dikhta hai:

```
postgresql://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

`[YOUR-PASSWORD]` ki jagah step 1 wala database password daalein. Yahi value
Railway me `DATABASE_URL` banti hai. Isi se app boot par saari tables, security
rules aur media bucket khud bana leta hai — aapko koi SQL haath se nahi chalani.

---

## 4. Login settings

**Authentication → URL Configuration**:

- **Site URL**: `https://contentengineer.techaasvik.in` (ya aapka Railway domain)
- **Redirect URLs** me add karein:
  - `https://contentengineer.techaasvik.in/**`
  - `https://<aapka>.up.railway.app/**`

**Authentication → Sign In / Providers → Email**: `Confirm email` **ON** rakhein.

Google se login chahiye to usi page par **Google** provider enable karein aur
apni Google Cloud OAuth client ID/secret daal dein, aur Google console me
redirect URI `https://<project-ref>.supabase.co/auth/v1/callback` add karein.

---

## 5. Pehla deploy

Railway par saari variables daal kar deploy karein (dekhein `DEPLOY-RAILWAY.md`).
Boot par migrations apne aap chal jayengi — logs me `[migrate] applied N
migration(s)` dikhega.

---

## 6. Super admin banayein

1. App khulne par `/auth` par apne admin email se **sign up** karein aur mail me
   aaya confirmation link kholein.
2. Supabase → **SQL Editor** me ye chala dein (email apna daalein):

```sql
insert into public.platform_roles (user_id, role)
select id, 'super_admin'::platform_role from auth.users
where lower(email) = 'contact@techaavik.com'
on conflict do nothing;
```

3. Ab `/auth` se login karein — seedha `/admin` console khulega.

---

## 7. Check list

- [ ] `/` aur `/auth` khul rahe hain
- [ ] Sign up + email confirmation chal raha hai
- [ ] Login ke baad `/dashboard` par workspace ban gaya
- [ ] Super admin ko `/admin` mil raha hai
- [ ] Create Post me image upload ho rahi hai (media bucket test)

Kahin atkein to error ka screenshot bhej dein.

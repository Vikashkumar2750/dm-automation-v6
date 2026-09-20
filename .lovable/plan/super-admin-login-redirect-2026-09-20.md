# Super-admin login redirect

## Goal
After a successful sign-in, send verified platform super admins directly to `/admin`; send every other user to `/dashboard`.

## Changes
- Add one authenticated server check that reads the platform role securely from the database.
- Update email/password, Google, existing-session, and auth-state redirects to use the same role-aware destination.
- Keep `/admin` protected by login and its existing server-side super-admin checks.
- Do not show a Super Admin link anywhere in the user dashboard.
- Leave YouTube unchanged.

## Verification
- Test `contact@techaavik.com` sign-in from `/auth` and confirm automatic arrival at `/admin` with Platform Overview visible.
- Test direct `/admin` behavior while signed out and verify it returns to `/auth`.
- Check non-admin fallback logic, type safety, and browser console errors.

## Technical details
The email itself will not be trusted in browser code. The redirect will use the existing `platform_roles` database authorization through an authenticated server function, so changing an email or browser state cannot grant admin access.

# Super-admin user editing and public website essentials

## Goal
Give super admins safe profile controls, add essential support/legal pages, repair and enlarge the Meta Business Partner badge, and replace the public footer with a professional shared footer—without changing automation behavior.

## Changes

### 1. Super-admin user profile controls
- Add an **Edit user** dialog on Admin → Users.
- Allow a super admin to update the user’s full name, login email, and set a new password.
- Validate email and password on both the form and server; require a strong minimum password length.
- Perform identity changes only in the protected admin function after re-checking the super-admin role.
- Keep the profile email and login email synchronized, record every change in Security & Audit, and never display an existing password.
- Keep existing suspend, reset-email, and platform-role controls unchanged.

### 2. Contact and support inquiries
- Add a public **Contact & Support** page with name, email, subject, category, and message fields.
- Validate and securely store inquiries in a new database table with locked access: anonymous visitors may submit, only super admins may read or update them.
- Add Admin → **Inquiries** with search, status filters, message details, and open/resolved state.
- Use the super-admin-configured alert email from System Settings as the destination for new-inquiry notifications.
- The admin inbox remains the guaranteed source of truth. Email delivery will use a server-side mail provider key; if no provider is configured, submission still succeeds and the inquiry is visibly marked as “email notification pending” for the admin instead of losing the message.

### 3. Essential public pages
- Add **Disclaimer** and **Refund & Cancellation Policy** pages with clear, India-oriented SaaS wording.
- Include platform-independence, third-party availability, automation-result limitations, payment/refund timing, trial/subscription treatment, and contact details.
- Keep the existing Privacy Policy, Terms, and Data Deletion pages.
- Add unique page title, description, Open Graph metadata, and Twitter card metadata to every new page.

### 4. Shared professional footer and branding
- Create one shared public footer used by the home page and all legal/support pages.
- Include logo and product name, concise product description, grouped Product / Support / Legal links, support email, social-platform trademark note, and dynamic copyright year.
- Repair the Meta Business Partner image display and increase its size on the home page and footer while keeping its aspect ratio.
- Make the footer stack cleanly on mobile and remain compact on desktop.

## Safety
- Do not modify automation execution, Meta webhook handling, follow gates, messaging, limits, or existing automation tests.
- Keep all privileged user edits and inquiry reads behind the existing server-validated super-admin authorization.
- Rate-limit public inquiry submission and avoid exposing inquiry data or configured alert addresses publicly.

## Verification
- Confirm a super admin can edit name/email/password and that the affected user can sign in with the new credentials.
- Confirm invalid email, weak password, and non-admin requests are rejected.
- Submit a support inquiry signed out, verify it appears in Admin → Inquiries, and verify status changes.
- Confirm notification delivery or the explicit pending state when no mail provider is configured.
- Check all footer links, the repaired partner badge, and new pages on desktop and mobile.
- Run the existing automation regression suite and confirm the app builds without errors.

## Technical details
- Extend the existing protected admin user function rather than creating a public identity endpoint.
- Add a `public.support_inquiries` table with explicit grants, row-level security, bounded fields, timestamps, status, and notification state.
- Add a public server function for validated submissions and a protected server function for super-admin listing/status changes.
- Keep outbound email credentials server-only; no key or recipient address is returned to the browser.

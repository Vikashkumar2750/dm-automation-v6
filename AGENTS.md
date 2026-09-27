<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Tool limits (plan DMs/month + active rules, super-admin override) stored in platform_settings.feature_flags (plans config + plan_limits_<orgId>); checked in runAutomations before new flows only — why: no schema change, never cuts mid-flow contacts.
- Public support inquiries are written only by a validated server function and read through super-admin authorization — why: anonymous visitors can contact support without exposing inquiry data.
- Unsigned webhook probes stay rejected and audited but are excluded from Breaking alerts — why: public callback scans are not Meta delivery failures.
- New automation drafts default to comment-to-DM, and deployment repairs only rules with clear comment intent that were saved as DM rules — why: prevents valid comments from being skipped without changing delivery flow.

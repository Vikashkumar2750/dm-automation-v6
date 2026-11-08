-- Read-only: run against the live database, not the separate connected backend.
-- Returns safe schedule metadata only, never raw commands or secret headers.
SELECT jobid, schedule, active,
  CASE WHEN command LIKE '%/api/public/cron/db-backup%'
    THEN 'retired_backup_caller' ELSE 'other_job' END AS job_kind
FROM cron.job
ORDER BY jobid;
-- If cron.job does not exist, this database has no installed pg_cron inventory.
-- That does not inspect Railway services or external scheduling providers.
-- For a confirmed retired_backup_caller only, use its displayed jobid in:
-- SELECT cron.unschedule(<confirmed_jobid>);
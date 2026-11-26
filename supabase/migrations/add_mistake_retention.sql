-- Remove mistake records and their review history after seven days of inactivity.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.delete_expired_mistakes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  DELETE FROM public.mistakes
  WHERE last_attempted_at < pg_catalog.now() - INTERVAL '7 days';
$$;

REVOKE ALL ON FUNCTION public.delete_expired_mistakes() FROM PUBLIC;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'delete-expired-mistakes';

SELECT cron.schedule(
  'delete-expired-mistakes',
  '0 3 * * *',
  'SELECT public.delete_expired_mistakes();'
);

from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'lib' / 'summary-api.js'
text = path.read_text(encoding='utf-8')

old = r'''  const usage = await db.query(
    `
with bucket as (
  insert into external_api_usage_windows (api_key_id, window_start, request_count)
  values ($1::uuid, date_trunc('minute', now()), 1)
  on conflict (api_key_id, window_start)
  do update set request_count = external_api_usage_windows.request_count + 1
  returning request_count, window_start
), touched as (
  update external_api_keys
  set last_used_at = now(), request_count = request_count + 1
  where id = $1::uuid
  returning id
)
select request_count,
       window_start,
       window_start + interval '1 minute' reset_at
from bucket;`,
    [key.api_key_id]
  );
  const rate = {
    count: Number(usage.rows[0]?.request_count || 1),
    resetAt: isoDate(usage.rows[0]?.reset_at) || new Date(Date.now() + 60_000).toISOString()
  };
'''
new = r'''  const usage = await db.query(
    `
update external_api_keys
set last_used_at = now(),
    request_count = request_count + 1,
    rate_window_count = case
      when rate_window_start is null or rate_window_start < date_trunc('minute', now()) then 1
      else rate_window_count + 1
    end,
    rate_window_start = case
      when rate_window_start is null or rate_window_start < date_trunc('minute', now()) then date_trunc('minute', now())
      else rate_window_start
    end
where id = $1::uuid
returning rate_window_count request_count,
          rate_window_start window_start,
          rate_window_start + interval '1 minute' reset_at;`,
    [key.api_key_id]
  );
  const rate = {
    count: Number(usage.rows[0]?.request_count || 1),
    resetAt: isoDate(usage.rows[0]?.reset_at) || new Date(Date.now() + 60_000).toISOString()
  };
'''
if text.count(old) != 1:
    raise SystemExit(f'rate limiter block marker count={text.count(old)}')
text = text.replace(old, new, 1)

old_cleanup = '''async function listManagedKeys(db, campaignSlug) {\n  await db.query("delete from external_api_usage_windows where window_start < now() - interval '7 days'").catch(() => {});\n'''
new_cleanup = '''async function listManagedKeys(db, campaignSlug) {\n'''
if text.count(old_cleanup) != 1:
    raise SystemExit(f'cleanup marker count={text.count(old_cleanup)}')
text = text.replace(old_cleanup, new_cleanup, 1)

path.write_text(text, encoding='utf-8')
print('Refined summary API rate limiter.')

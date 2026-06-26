-- Run this in Supabase SQL editor to enable the All Modes combined leaderboard.
create or replace function get_combined_scores(p_limit int default 50)
returns table (
  user_id uuid,
  username text,
  total_score bigint,
  arithmetic_best int,
  bubble_burst_best int,
  falling_equations_best int,
  number_hunt_best int
) language sql security definer as $$
  select
    p.id as user_id,
    p.username,
    coalesce(a.best, 0) + coalesce(b.best, 0) + coalesce(f.best, 0) + coalesce(n.best, 0) as total_score,
    coalesce(a.best, 0) as arithmetic_best,
    coalesce(b.best, 0) as bubble_burst_best,
    coalesce(f.best, 0) as falling_equations_best,
    coalesce(n.best, 0) as number_hunt_best
  from public.profiles p
  left join (select user_id, max(score) as best from public.scores where mode = 'arithmetic' group by user_id) a on a.user_id = p.id
  left join (select user_id, max(score) as best from public.scores where mode = 'bubble-burst' group by user_id) b on b.user_id = p.id
  left join (select user_id, max(score) as best from public.scores where mode = 'falling-equations' group by user_id) f on f.user_id = p.id
  left join (select user_id, max(score) as best from public.scores where mode = 'number-hunt' group by user_id) n on n.user_id = p.id
  where (coalesce(a.best, 0) + coalesce(b.best, 0) + coalesce(f.best, 0) + coalesce(n.best, 0)) > 0
  order by total_score desc
  limit p_limit;
$$;

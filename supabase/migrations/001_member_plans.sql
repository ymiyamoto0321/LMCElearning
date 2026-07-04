-- =========================================================
-- 移行SQL 001: 有効期限を「会員単位」→「契約プラン単位」へ変更
-- 対象: すでに schema.sql（初版）を適用済みの稼働中DB
-- 実行: Supabase SQL Editor に全文貼り付けて Run（1回のみ）
-- =========================================================

-- 1) 契約テーブルを新設
create table if not exists member_plans (
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid not null references plans(id),
  expires_at date not null,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

-- 2) 既存データを移行（profiles.plan_id / expires_at → member_plans）
insert into member_plans (user_id, plan_id, expires_at, status)
select id, plan_id, expires_at, 'active'
from profiles
where role = 'member' and plan_id is not null
on conflict (user_id, plan_id) do nothing;

-- 3) 旧ポリシー・旧関数を削除（my_plan_id 依存のもの）
drop policy if exists "plans_select" on plans;
drop policy if exists "plan_courses_select" on plan_courses;
drop function if exists can_view_course(uuid);
drop function if exists my_plan_id();

-- 4) 新しい関数
create or replace function my_valid_plan(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from member_plans
    where user_id = auth.uid() and plan_id = pid
      and status = 'active' and expires_at >= current_date
  );
$$;

create or replace function can_view_course(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1
    from member_plans mp
    join plan_courses pc on pc.plan_id = mp.plan_id
    where mp.user_id = auth.uid()
      and mp.status = 'active' and mp.expires_at >= current_date
      and pc.course_id = cid
  );
$$;

-- 5) 新しいポリシー
alter table member_plans enable row level security;
create policy "member_plans_select" on member_plans for select using (user_id = auth.uid() or is_admin());
create policy "member_plans_admin_all" on member_plans for all using (is_admin()) with check (is_admin());
create policy "plans_select" on plans for select using (my_valid_plan(id) or is_admin());
create policy "plan_courses_select" on plan_courses for select using (my_valid_plan(plan_id) or is_admin());

-- 6) profiles から旧カラムを削除
alter table profiles drop column if exists plan_id;
alter table profiles drop column if exists expires_at;

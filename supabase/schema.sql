-- =========================================================
-- LMC e-learning データベース定義（詳細設計書 v1.0 準拠）
-- Supabase (PostgreSQL・東京リージョン) の SQL Editor で実行する
-- =========================================================

-- ---------- テーブル ----------
-- ※作成順に依存関係あり: plans → profiles（plan_id が plans を参照）

-- 契約プラン
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

-- コース
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sort_order integer not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- 会員（auth.users と1対1）
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'active' check (status in ('active','suspended')),
  theme text not null default 'standard' check (theme in ('standard','rose')),
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- 契約（会員×プラン）。有効期限・強制無効化は契約単位で管理
-- すべての契約が期限切れ/無効化になった会員はログイン不可（アプリ側で判定）
create table if not exists member_plans (
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid not null references plans(id),
  expires_at date not null,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

-- プラン×コース割当（多対多）
create table if not exists plan_courses (
  plan_id uuid not null references plans(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  primary key (plan_id, course_id)
);

-- 章
create table if not exists sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  title text not null,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

-- レッスン
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id),
  title text not null,
  description text,
  video_id text not null,
  pdf_url text,
  sort_order integer not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- テスト問題
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  question_text text not null,
  choices jsonb not null,
  correct_index integer not null check (correct_index between 0 and 3),
  explanation text,
  created_at timestamptz not null default now()
);

-- 学習記録（会員×レッスン）
create table if not exists progress (
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  view_count integer not null default 0,
  watched_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- テスト結果（受験ごとに1行）
create table if not exists quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  score integer not null check (score between 0 and 5),
  passed boolean not null,
  taken_at timestamptz not null default now()
);

-- お気に入り
create table if not exists favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ---------- ヘルパー関数 ----------

-- 管理者判定
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 自分がそのプランの有効な契約（期限内・無効化されていない）を持つか
create or replace function my_valid_plan(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from member_plans
    where user_id = auth.uid() and plan_id = pid
      and status = 'active' and expires_at >= current_date
  );
$$;

-- 有効な契約のプランで閲覧できるコースか
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

-- ---------- RLS（行レベルセキュリティ） ----------

alter table profiles enable row level security;
alter table member_plans enable row level security;
alter table plans enable row level security;
alter table courses enable row level security;
alter table plan_courses enable row level security;
alter table sections enable row level security;
alter table lessons enable row level security;
alter table questions enable row level security;
alter table progress enable row level security;
alter table quiz_results enable row level security;
alter table favorites enable row level security;

-- profiles: 本人は自分の行のみ閲覧・テーマ等更新可 / adminは全操作
create policy "profiles_select_own" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update using (id = auth.uid() or is_admin());
create policy "profiles_admin_insert" on profiles for insert with check (is_admin());
create policy "profiles_admin_delete" on profiles for delete using (is_admin());

-- member_plans（契約）: 本人は自分の契約のみ閲覧 / adminは全操作
create policy "member_plans_select" on member_plans for select using (user_id = auth.uid() or is_admin());
create policy "member_plans_admin_all" on member_plans for all using (is_admin()) with check (is_admin());

-- plans / plan_courses: 会員は有効な契約のプランのみ / adminは全操作
create policy "plans_select" on plans for select using (my_valid_plan(id) or is_admin());
create policy "plans_admin_all" on plans for all using (is_admin()) with check (is_admin());
create policy "plan_courses_select" on plan_courses for select using (my_valid_plan(plan_id) or is_admin());
create policy "plan_courses_admin_all" on plan_courses for all using (is_admin()) with check (is_admin());

-- courses: 会員はプラン内・公開中のみ / adminは全操作
create policy "courses_select" on courses for select
  using ((is_published and can_view_course(id)) or is_admin());
create policy "courses_admin_all" on courses for all using (is_admin()) with check (is_admin());

-- sections: プラン内コースの章のみ
create policy "sections_select" on sections for select
  using (can_view_course(course_id) or is_admin());
create policy "sections_admin_all" on sections for all using (is_admin()) with check (is_admin());

-- lessons: プラン内コースの公開中レッスンのみ
create policy "lessons_select" on lessons for select
  using (
    is_admin() or (
      is_published and exists (
        select 1 from sections s
        where s.id = lessons.section_id and can_view_course(s.course_id)
      )
    )
  );
create policy "lessons_admin_all" on lessons for all using (is_admin()) with check (is_admin());

-- questions: 閲覧可能レッスンの問題のみ
create policy "questions_select" on questions for select
  using (
    is_admin() or exists (
      select 1 from lessons l join sections s on s.id = l.section_id
      where l.id = questions.lesson_id and l.is_published and can_view_course(s.course_id)
    )
  );
create policy "questions_admin_all" on questions for all using (is_admin()) with check (is_admin());

-- progress: 本人のみ読み書き / adminは閲覧
create policy "progress_own" on progress for select using (user_id = auth.uid() or is_admin());
create policy "progress_insert_own" on progress for insert with check (user_id = auth.uid());
create policy "progress_update_own" on progress for update using (user_id = auth.uid());

-- quiz_results: 本人のみ作成・閲覧 / adminは閲覧
create policy "quiz_results_select" on quiz_results for select using (user_id = auth.uid() or is_admin());
create policy "quiz_results_insert_own" on quiz_results for insert with check (user_id = auth.uid());

-- favorites: 本人のみ / adminは閲覧
create policy "favorites_select" on favorites for select using (user_id = auth.uid() or is_admin());
create policy "favorites_insert_own" on favorites for insert with check (user_id = auth.uid());
create policy "favorites_delete_own" on favorites for delete using (user_id = auth.uid());

-- ---------- 初期データ（シード） ----------
-- プラン・コース・章・レッスンの例。本番投入時は管理画面から登録してもよい。

insert into plans (name, description, sort_order) values
  ('ベーシック', '経営コースのみ', 1),
  ('プレミアム', '経営＋営業の全コース', 2);

insert into courses (title, description, sort_order, is_published) values
  ('経営コース', '経営の土台と数字に強くなる', 1, true),
  ('営業コース', '売れる営業の型を身につける', 2, true);

insert into plan_courses (plan_id, course_id)
select p.id, c.id from plans p, courses c
where (p.name = 'ベーシック' and c.title = '経営コース')
   or (p.name = 'プレミアム');

-- 注意:
-- 1) 管理者アカウントは scripts/create-admin.mjs で作成する（Auth＋profiles）。
--    管理者は契約（member_plans）不要で全コース閲覧可。
-- 2) 会員の発行は管理画面（会員管理）から行う。Auth ユーザー作成には
--    service_role キーが必要なため、サーバー側（Route Handler）で実装する。

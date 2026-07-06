-- 移行SQL 002: テーマに「ビューティ（beauty）」を追加
-- 実行: Supabase SQL Editor に貼り付けて Run（1回のみ）
alter table profiles drop constraint if exists profiles_theme_check;
alter table profiles add constraint profiles_theme_check check (theme in ('standard','rose','beauty'));

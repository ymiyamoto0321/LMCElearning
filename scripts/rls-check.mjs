// RLS動作検証スクリプト（本番公開前の必須チェック）
// 使い方:
//   node scripts/rls-check.mjs
//   （会員視点の検証も行う場合）
//   TEST_MEMBER_EMAIL=xxx TEST_MEMBER_PASSWORD=xxx node scripts/rls-check.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// .env.local を読む
let env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch { /* 環境変数から取得 */ }
const URL = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON) { console.error("❌ NEXT_PUBLIC_SUPABASE_URL / ANON_KEY が未設定です（.env.local）"); process.exit(1); }

const TABLES = ["profiles", "member_plans", "plans", "plan_courses", "courses", "sections", "lessons", "questions", "progress", "quiz_results", "favorites"];
let failed = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};

// 1) 未ログイン: 全テーブル0件であること
{
  const anon = createClient(URL, ANON);
  for (const t of TABLES) {
    const { data, error } = await anon.from(t).select("*").limit(5);
    check(`未ログイン ${t} が読めない`, (data ?? []).length === 0, error ? error.message : `${(data ?? []).length}件`);
  }
}

// 2) 会員: 自分の記録のみ・プラン外コース/下書きレッスンが見えない
const email = process.env.TEST_MEMBER_EMAIL, pass = process.env.TEST_MEMBER_PASSWORD;
if (email && pass) {
  const c = createClient(URL, ANON);
  const { data: auth, error } = await c.auth.signInWithPassword({ email, password: pass });
  if (error) { check("会員ログイン", false, error.message); }
  else {
    const uid = auth.user.id;
    const { data: prog } = await c.from("progress").select("user_id");
    check("会員 progress は自分の行のみ", (prog ?? []).every(r => r.user_id === uid), `${(prog ?? []).length}件`);
    const { data: results } = await c.from("quiz_results").select("user_id");
    check("会員 quiz_results は自分の行のみ", (results ?? []).every(r => r.user_id === uid));
    const { data: lessons } = await c.from("lessons").select("is_published");
    check("会員に下書きレッスンが見えない", (lessons ?? []).every(r => r.is_published));
    const { data: profs } = await c.from("profiles").select("id");
    check("会員 profiles は自分の行のみ", (profs ?? []).length === 1 && profs[0].id === uid);
    const { data: myContracts } = await c.from("member_plans").select("user_id, plan_id, status, expires_at");
    check("会員 member_plans は自分の契約のみ", (myContracts ?? []).every(r => r.user_id === uid));
    const today = new Date().toISOString().slice(0, 10);
    const validPlans = new Set((myContracts ?? []).filter(r => r.status === "active" && r.expires_at >= today).map(r => r.plan_id));
    const { data: pcs } = await c.from("plan_courses").select("plan_id");
    check("会員 plan_courses は有効な契約のプランのみ", (pcs ?? []).every(r => validPlans.has(r.plan_id)));
    await c.auth.signOut();
  }
} else {
  console.log("ℹ️  会員視点の検証をスキップ（TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD を指定すると実行）");
}

console.log(failed === 0 ? "\n🎉 RLS検証: すべて合格" : `\n⚠️ RLS検証: ${failed}件 失敗`);
process.exit(failed === 0 ? 0 : 1);

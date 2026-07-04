// 管理者アカウント作成スクリプト（初回セットアップ用）
// 使い方: node scripts/create-admin.mjs <メールアドレス> <パスワード8文字以上> [氏名]
// .env.local の NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を使用する。
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

let env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch { /* noop */ }
const URL = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const [email, password, name = "管理者"] = process.argv.slice(2);
if (!URL || !SERVICE) { console.error("❌ .env.local に NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を設定してください"); process.exit(1); }
if (!email || !password || password.length < 8) {
  console.error("使い方: node scripts/create-admin.mjs <メールアドレス> <パスワード8文字以上> [氏名]");
  process.exit(1);
}

const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: created, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
if (error) { console.error("❌ Authユーザー作成に失敗:", error.message); process.exit(1); }

const { error: profErr } = await svc.from("profiles").insert({
  id: created.user.id, name, email, role: "admin", status: "active",
});
if (profErr) {
  await svc.auth.admin.deleteUser(created.user.id);
  console.error("❌ profiles登録に失敗:", profErr.message);
  process.exit(1);
}
console.log(`✅ 管理者を作成しました: ${name} <${email}>`);
console.log("   http://localhost:3000/login （または本番URL）からログインできます。");

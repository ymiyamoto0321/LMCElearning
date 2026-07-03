// 会員アカウントの発行・削除・仮パスワード再発行（管理者専用API）
// Supabase Auth のユーザー作成には service_role キーが必要なためサーバー側で実行する。
// service_role キーは RLS を無視できる強力なキーなので、このファイル以外では使用しない。
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** 呼び出し元が管理者であることを検証 */
async function requireAdmin(req: NextRequest) {
  const svc = serviceClient();
  if (!svc) return { error: NextResponse.json({ error: "サーバー設定（SUPABASE_SERVICE_ROLE_KEY）が未完了です。" }, { status: 500 }) };
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: NextResponse.json({ error: "認証情報がありません。" }, { status: 401 }) };
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "認証に失敗しました。" }, { status: 401 }) };
  const { data: profile } = await svc.from("profiles").select("role").eq("id", data.user.id).single();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "管理者権限が必要です。" }, { status: 403 }) };
  return { svc };
}

// POST: 会員発行（Authユーザー作成＋profiles行作成）
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { svc } = auth;
  const body = await req.json();
  const { name, email, password, plan_id, expires_at, theme } = body;
  if (!name || !email || !password || !expires_at) {
    return NextResponse.json({ error: "必須項目（氏名・メール・パスワード・有効期限日）が不足しています。" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "初期パスワードは8文字以上にしてください。" }, { status: 400 });
  }
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !created.user) {
    return NextResponse.json({ error: "アカウント作成に失敗しました: " + (createErr?.message ?? "") }, { status: 400 });
  }
  const { error: profErr } = await svc.from("profiles").insert({
    id: created.user.id, name, email, role: "member", status: "active",
    plan_id: plan_id || null, expires_at, theme: theme || "standard",
  });
  if (profErr) {
    await svc.auth.admin.deleteUser(created.user.id); // ロールバック
    return NextResponse.json({ error: "会員情報の登録に失敗しました: " + profErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user_id: created.user.id });
}

// DELETE: 会員削除（Authユーザー削除→profiles等はcascade）
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { svc } = auth;
  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: "user_id が必要です。" }, { status: 400 });
  const { error } = await svc.auth.admin.deleteUser(user_id);
  if (error) return NextResponse.json({ error: "削除に失敗しました: " + error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// PATCH: 仮パスワード再発行
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const { svc } = auth;
  const { user_id, password } = await req.json();
  if (!user_id || !password) return NextResponse.json({ error: "user_id と password が必要です。" }, { status: 400 });
  if (String(password).length < 8) return NextResponse.json({ error: "仮パスワードは8文字以上にしてください。" }, { status: 400 });
  const { error } = await svc.auth.admin.updateUserById(user_id, { password });
  if (error) return NextResponse.json({ error: "再発行に失敗しました: " + error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

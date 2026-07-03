// Supabaseクライアント（ブラウザ用）
// anonキーは公開前提のキー（行レベルセキュリティで保護される）
// ※プロトタイプ段階では未使用。Supabase接続時に lib/store.tsx から利用する。
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null; // 未設定＝デモモード
  if (!client) client = createClient(url, anonKey);
  return client;
}

"use client";
// S-01 ログイン
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { LogoMark } from "@/components/ui";

export default function LoginPage() {
  const { login, isLive } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const doLogin = async (mail: string) => {
    setBusy(true);
    setErr("");
    const r = await login(mail, pass);
    setBusy(false);
    if (!r.ok) { setErr(r.message); return; }
    router.push("/"); // ロール別の振り分けはトップページで実施
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <LogoMark />
          <div className="logo">LMC <span>e-learning</span></div>
          <div className="tag">経営・営業アカデミー オンライン講座</div>
        </div>
        {err && <div className="login-err">{err}</div>}
        <form onSubmit={e => { e.preventDefault(); doLogin(email); }}>
          <div className="field">
            <label>メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label>パスワード</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" required={isLive} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "確認中..." : "ログイン"}</button>
        </form>
        <Link href="/reset-password"><span className="link-sub">パスワードをお忘れの方はこちら</span></Link>
        {!isLive && (
          <div className="demo-note">
            ― プロトタイプ用デモアカウント（パスワード不要）―<br />
            <button className="btn btn-ghost btn-sm" onClick={() => doLogin("member@demo.jp")}>会員（花子・プレミアム）</button>
            <button className="btn btn-ghost btn-sm" onClick={() => doLogin("sato@demo.jp")}>会員（佐藤・ベーシック）</button>
            <button className="btn btn-gold btn-sm" onClick={() => doLogin("info@life-m-c.com")}>管理者</button>
            <button className="btn btn-danger btn-sm" onClick={() => doLogin("tanaka@demo.jp")}>期限切れ会員</button>
          </div>
        )}
      </div>
    </div>
  );
}

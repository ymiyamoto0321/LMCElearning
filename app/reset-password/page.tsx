"use client";
// S-10 パスワード再設定（メール送信）
import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";

export default function ResetPasswordPage() {
  const { requestPasswordReset } = useStore();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const send = async () => {
    await requestPasswordReset(email);
    setSent(true); // 登録有無を推測されないよう常に「送信しました」を表示
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <div className="logo">パスワード再設定</div>
          <div className="tag">PASSWORD RESET</div>
        </div>
        {!sent ? (
          <form onSubmit={e => { e.preventDefault(); send(); }}>
            <p style={{ fontSize: 13.5, color: "var(--sub)", marginBottom: 14 }}>
              ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>
            <div className="field">
              <label>メールアドレス</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <button className="btn btn-primary" type="submit">再設定リンクを送信</button>
          </form>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, marginBottom: 6 }}>📧 再設定リンクを送信しました</p>
            <p style={{ fontSize: 12.5, color: "var(--sub)" }}>
              メール内のリンク（有効期限24時間）から新しいパスワードを設定してください。<br />
              メールが届かない場合は運営（info@life-m-c.com）までご連絡ください。仮パスワードを再発行します。
            </p>
          </div>
        )}
        <Link href="/login"><span className="link-sub">← ログイン画面へ戻る</span></Link>
      </div>
    </div>
  );
}

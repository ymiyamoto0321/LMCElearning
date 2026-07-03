"use client";
// S-10b 新パスワード設定（再設定メールのリンク先）
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function UpdatePasswordPage() {
  const { updatePassword } = useStore();
  const router = useRouter();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    setErr("");
    if (p1.length < 8) { setErr("パスワードは8文字以上にしてください。"); return; }
    if (p1 !== p2) { setErr("確認用パスワードが一致しません。"); return; }
    const r = await updatePassword(p1);
    if (!r.ok) { setErr(r.message); return; }
    setDone(true);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <div className="logo">新しいパスワードの設定</div>
          <div className="tag">SET NEW PASSWORD</div>
        </div>
        {!done ? (
          <form onSubmit={e => { e.preventDefault(); save(); }}>
            {err && <div className="login-err">{err}</div>}
            <div className="field">
              <label>新しいパスワード（8文字以上）</label>
              <input type="password" value={p1} onChange={e => setP1(e.target.value)} required />
            </div>
            <div className="field">
              <label>新しいパスワード（確認用）</label>
              <input type="password" value={p2} onChange={e => setP2(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit">パスワードを設定する</button>
          </form>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>✅ パスワードを設定しました</p>
            <button className="btn btn-gold" onClick={() => router.push("/login")}>ログイン画面へ</button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
// S-08 会員管理（発行・有効期限・プラン・テーマ・停止/再開・仮PW再発行・削除）
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Modal } from "@/components/ui";
import { Member, Theme } from "@/lib/types";

function addYears(dateStr: string, years: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export default function AdminMembersPage() {
  const s = useStore();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ name: "", email: "", password: "", planId: "", expiresAt: addYears(today, 1), theme: "standard" as Theme });
  const [msg, setMsg] = useState("");
  const [expEdit, setExpEdit] = useState<Member | null>(null);
  const [expDate, setExpDate] = useState("");

  if (!s.user) return null;
  const plans = [...s.db.plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const planName = (id: string | null) => s.db.plans.find(p => p.id === id)?.name ?? "―";

  const memberRate = (m: Member): string => {
    const allowed = new Set(s.db.planCourses.filter(pc => pc.planId === m.planId).map(pc => pc.courseId));
    const secIds = new Set(s.db.sections.filter(sec => allowed.has(sec.courseId)).map(sec => sec.id));
    const lessons = s.db.lessons.filter(l => l.isPublished && secIds.has(l.sectionId));
    if (!lessons.length) return "0%";
    const done = lessons.filter(l => s.db.progress.some(p => p.userId === m.id && p.lessonId === l.id && p.completedAt)).length;
    return `${Math.round((done / lessons.length) * 100)}%`;
  };

  const issue = async () => {
    setMsg("");
    if (!form.name.trim() || !form.email.trim()) { setMsg("氏名・メールアドレスは必須です。"); return; }
    if (form.password.length < 8) { setMsg("初期パスワードは8文字以上にしてください。"); return; }
    if (!form.planId) { setMsg("契約プランを選択してください。"); return; }
    const name = form.name.trim();
    const r = await s.addMember({
      name, email: form.email.trim(), status: "active",
      planId: form.planId, expiresAt: form.expiresAt, theme: form.theme,
    }, form.password);
    if (!r.ok) { setMsg(r.message); return; }
    setMsg(`✅ ${name} さんを発行しました。ログインURL・メール・初期パスワードを本人に案内してください。`);
    setForm({ name: "", email: "", password: "", planId: "", expiresAt: addYears(today, 1), theme: "standard" });
  };

  const reissuePassword = async (m: Member) => {
    const pw = prompt(`${m.name} さんの新しい仮パスワード（8文字以上）を入力してください`);
    if (!pw) return;
    if (pw.length < 8) { alert("仮パスワードは8文字以上にしてください。"); return; }
    const r = await s.resetMemberPassword(m.id, pw);
    alert(r.ok
      ? `仮パスワードを再発行しました。本人に新しいパスワードを案内し、ログイン後の変更を推奨してください。`
      : r.message);
  };

  const members = s.db.members.filter(m => m.role !== "admin");

  return (
    <>
      <div className="page-title">会員管理</div>
      <div className="page-sub">S-08｜契約成立後にアカウントを発行します。有効期限日を過ぎた会員は自動的にログインできなくなります</div>

      <div className="card">
        <h3>新規会員の発行</h3>
        {msg && <div className={msg.startsWith("✅") ? "badge b-done" : "login-err"} style={{ marginBottom: 10, display: "block" }}>{msg}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="inline" placeholder="氏名" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="inline" style={{ width: 210 }} placeholder="メールアドレス" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className="inline" style={{ width: 190 }} placeholder="初期パスワード（8文字以上）" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <select className="inline" value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}>
            <option value="">契約プランを選択</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label style={{ fontSize: 12.5, color: "var(--sub)" }}>有効期限日：
            <input className="inline" type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
          <label style={{ fontSize: 12.5, color: "var(--sub)" }}>初期テーマ：
            <select className="inline" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value as Theme })}>
              <option value="standard">スタンダード</option>
              <option value="rose">ローズ（女性向け）</option>
            </select>
          </label>
          <button className="btn btn-gold btn-sm" onClick={issue}>発行する</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 6 }}>※有効期限日の既定値は発行日＋1年。継続契約時は一覧の「期限変更」で延長します。</div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>氏名</th><th>メール</th><th>状態</th><th>プラン</th><th>有効期限</th><th>最終ログイン</th><th>達成率</th><th>操作</th></tr>
          </thead>
          <tbody>
            {members.map(m => {
              const expired = m.expiresAt < today;
              const soon = !expired && (new Date(m.expiresAt).getTime() - new Date(today).getTime()) / 86400000 <= 30;
              return (
                <tr key={m.id}>
                  <td><b>{m.name}</b></td>
                  <td>{m.email}</td>
                  <td>
                    {m.status === "suspended" ? <span className="badge b-draft">停止</span>
                      : expired ? <span className="badge b-draft">期限切れ</span>
                      : <span className="badge b-done">有効</span>}
                  </td>
                  <td>
                    <select className="inline" style={{ padding: "4px 6px", fontSize: 12.5 }} value={m.planId ?? ""} onChange={e => s.updateMember(m.id, { planId: e.target.value || null })}>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td>
                    {m.expiresAt.replace(/-/g, "/")}{" "}
                    {expired ? <span className="badge b-draft">期限切れ</span> : soon ? <span className="badge b-watch">まもなく期限</span> : null}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{m.lastLoginAt ? m.lastLoginAt.slice(0, 16).replace("T", " ").replace(/-/g, "/") : "未ログイン"}</td>
                  <td>{memberRate(m)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setExpEdit(m); setExpDate(m.expiresAt); }}>期限変更</button>{" "}
                    <button className="btn btn-ghost btn-sm" onClick={() => reissuePassword(m)}>仮PW再発行</button>{" "}
                    <button className="btn btn-ghost btn-sm" onClick={() => s.updateMember(m.id, { status: m.status === "active" ? "suspended" : "active" })}>
                      {m.status === "active" ? "停止" : "再開"}
                    </button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      if (confirm(`${m.name} さんを削除しますか？\n※学習記録・テスト結果もすべて削除されます（契約終了は「停止」を推奨）`)) s.deleteMember(m.id);
                    }}>削除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {expEdit && (
        <Modal title={`有効期限日の変更：${expEdit.name}`} onClose={() => setExpEdit(null)}>
          <div className="field">
            <label>有効期限日</label>
            <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpDate(addYears(expDate, 1))}>＋1年</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setExpDate(addYears(today, 1))}>今日から1年</button>
          </div>
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => setExpEdit(null)}>キャンセル</button>
            <button className="btn btn-gold" onClick={() => { s.updateMember(expEdit.id, { expiresAt: expDate }); setExpEdit(null); }}>保存</button>
          </div>
        </Modal>
      )}
    </>
  );
}

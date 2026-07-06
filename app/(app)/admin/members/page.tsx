"use client";
// S-08 会員管理（発行・契約プランごとの有効期限/無効化・停止/再開・仮PW再発行）
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Modal } from "@/components/ui";
import { Member, Contract, Theme, isContractValid } from "@/lib/types";

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
  const [expEdit, setExpEdit] = useState<{ member: Member; contract: Contract } | null>(null);
  const [expDate, setExpDate] = useState("");
  const [addTo, setAddTo] = useState<Member | null>(null); // 契約追加対象
  const [addPlanId, setAddPlanId] = useState("");
  const [addExp, setAddExp] = useState(addYears(today, 1));

  if (!s.user) return null;
  const plans = [...s.db.plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const planName = (id: string) => s.db.plans.find(p => p.id === id)?.name ?? "―";

  // 会員の閲覧対象レッスン（全契約のプランに紐づく公開レッスン）で達成率を計算
  const memberRate = (m: Member): string => {
    const planIds = new Set(s.contractsOf(m.id).map(c => c.planId));
    const courseIds = new Set(s.db.planCourses.filter(pc => planIds.has(pc.planId)).map(pc => pc.courseId));
    const secIds = new Set(s.db.sections.filter(sec => courseIds.has(sec.courseId)).map(sec => sec.id));
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
    const r = await s.addMember(
      { name, email: form.email.trim(), status: "active", theme: form.theme },
      form.password, form.planId, form.expiresAt,
    );
    if (!r.ok) { setMsg(r.message); return; }
    setMsg(`✅ ${name} さんを発行しました。ログインURL・メール・初期パスワードを本人に案内してください。`);
    setForm({ name: "", email: "", password: "", planId: "", expiresAt: addYears(today, 1), theme: "standard" });
  };

  const reissuePassword = async (m: Member) => {
    const pw = prompt(`${m.name} さんの新しい仮パスワード（8文字以上）を入力してください`);
    if (!pw) return;
    if (pw.length < 8) { alert("仮パスワードは8文字以上にしてください。"); return; }
    const r = await s.resetMemberPassword(m.id, pw);
    alert(r.ok ? "仮パスワードを再発行しました。本人に案内し、ログイン後の変更を推奨してください。" : r.message);
  };

  // 会員の状態: 停止 ＞ 期限切れ（有効契約なし） ＞ 有効
  const memberState = (m: Member): { label: string; cls: string } => {
    if (m.status === "suspended") return { label: "停止", cls: "b-draft" };
    if (!s.hasValidAccess(m.id)) return { label: "期限切れ", cls: "b-draft" };
    return { label: "有効", cls: "b-done" };
  };

  const contractBadge = (c: Contract) => {
    if (c.status === "disabled") return <span className="badge b-draft">無効化中</span>;
    if (c.expiresAt < today) return <span className="badge b-draft">期限切れ</span>;
    if ((new Date(c.expiresAt).getTime() - new Date(today).getTime()) / 86400000 <= 30)
      return <span className="badge b-watch">まもなく期限</span>;
    return <span className="badge b-done">有効</span>;
  };

  const members = s.db.members.filter(m => m.role !== "admin");

  return (
    <>
      <div className="page-title">会員管理</div>
      <div className="page-sub">S-08｜有効期限は契約プランごとに管理します。すべての契約が期限切れ・無効化になると、その会員はログインできなくなります</div>

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
          <label style={{ fontSize: 12.5, color: "var(--sub)" }}>契約の有効期限：
            <input className="inline" type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
          <label style={{ fontSize: 12.5, color: "var(--sub)" }}>初期テーマ：
            <select className="inline" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value as Theme })}>
              <option value="standard">スタンダード</option>
              <option value="rose">ローズ（女性向け）</option>
              <option value="beauty">ビューティ（美容サロン風）</option>
            </select>
          </label>
          <button className="btn btn-gold btn-sm" onClick={issue}>発行する</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 6 }}>※発行後、一覧の「＋契約追加」で複数プランを契約できます。期限の既定値は発行日＋1年。</div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>氏名</th><th>メール</th><th>状態</th><th style={{ minWidth: 340 }}>契約プラン（プランごとの有効期限）</th><th>最終ログイン</th><th>達成率</th><th>操作</th></tr>
          </thead>
          <tbody>
            {members.map(m => {
              const st = memberState(m);
              const cs = s.contractsOf(m.id);
              return (
                <tr key={m.id}>
                  <td><b>{m.name}</b></td>
                  <td>{m.email}</td>
                  <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  <td>
                    {cs.length === 0 && <span style={{ color: "var(--sub)", fontSize: 12.5 }}>契約なし</span>}
                    {cs.map(c => (
                      <div key={c.planId} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <b style={{ fontSize: 12.5 }}>{planName(c.planId)}</b>
                        <span style={{ fontSize: 12 }}>{c.expiresAt.replace(/-/g, "/")}まで</span>
                        {contractBadge(c)}
                        <button className="btn btn-ghost btn-sm" onClick={() => { setExpEdit({ member: m, contract: c }); setExpDate(c.expiresAt); }}>期限変更</button>
                        {c.status === "active" ? (
                          <button className="btn btn-danger btn-sm" onClick={() => {
                            if (confirm(`「${planName(c.planId)}」の契約を強制的に無効化しますか？\n※この契約のコースは即時閲覧できなくなります`)) s.setContractStatus(m.id, c.planId, "disabled");
                          }}>無効化</button>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => s.setContractStatus(m.id, c.planId, "active")}>再有効化</button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => {
                          if (confirm(`「${planName(c.planId)}」の契約を削除しますか？（履歴も残りません。通常は無効化を推奨）`)) s.deleteContract(m.id, c.planId);
                        }}>削除</button>
                      </div>
                    ))}
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAddTo(m); setAddPlanId(""); setAddExp(addYears(today, 1)); }}>＋ 契約追加</button>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{m.lastLoginAt ? m.lastLoginAt.slice(0, 16).replace("T", " ").replace(/-/g, "/") : "未ログイン"}</td>
                  <td>{memberRate(m)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => reissuePassword(m)}>仮PW再発行</button>{" "}
                    <button className="btn btn-ghost btn-sm" onClick={() => s.updateMember(m.id, { status: m.status === "active" ? "suspended" : "active" })}>
                      {m.status === "active" ? "停止" : "再開"}
                    </button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      if (confirm(`${m.name} さんを削除しますか？\n※契約・学習記録もすべて削除されます（契約終了は「停止」または契約の無効化を推奨）`)) s.deleteMember(m.id);
                    }}>削除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {expEdit && (
        <Modal title={`契約期限の変更：${expEdit.member.name}（${planName(expEdit.contract.planId)}）`} onClose={() => setExpEdit(null)}>
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
            <button className="btn btn-gold" onClick={() => { s.updateContractExpiry(expEdit.member.id, expEdit.contract.planId, expDate); setExpEdit(null); }}>保存</button>
          </div>
        </Modal>
      )}

      {addTo && (
        <Modal title={`契約追加：${addTo.name}`} onClose={() => setAddTo(null)}>
          <div className="field">
            <label>プラン</label>
            <select value={addPlanId} onChange={e => setAddPlanId(e.target.value)}>
              <option value="">選択してください</option>
              {plans.filter(p => !s.contractsOf(addTo.id).some(c => c.planId === p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>有効期限日</label>
            <input type="date" value={addExp} onChange={e => setAddExp(e.target.value)} />
          </div>
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => setAddTo(null)}>キャンセル</button>
            <button className="btn btn-gold" onClick={() => {
              if (!addPlanId) return;
              const r = s.addContract(addTo.id, addPlanId, addExp);
              if (!r.ok) { alert(r.message); return; }
              setAddTo(null);
            }}>契約を追加</button>
          </div>
        </Modal>
      )}
    </>
  );
}

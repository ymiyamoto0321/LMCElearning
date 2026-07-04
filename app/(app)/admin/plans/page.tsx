"use client";
// S-11 プラン・コース管理（契約プランの作成・コース割当／コースのCRUD・並べ替え・公開切替）
import { useState } from "react";
import { useStore } from "@/lib/store";

export default function AdminPlansPage() {
  const s = useStore();
  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseDesc, setCourseDesc] = useState("");

  if (!s.user) return null;
  const plans = [...s.db.plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const courses = [...s.db.courses].sort((a, b) => a.sortOrder - b.sortOrder);
  const has = (planId: string, courseId: string) =>
    s.db.planCourses.some(pc => pc.planId === planId && pc.courseId === courseId);
  const memberCount = (planId: string) => s.db.contracts.filter(c => c.planId === planId).length;

  return (
    <>
      <div className="page-title">プラン・コース管理</div>
      <div className="page-sub">S-11｜契約プランにコースを割り当てます。会員はプランに割り当てられたコースだけが見えます</div>

      <div className="card">
        <h3>契約プランとコースの割当</h3>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>プラン</th>
                {courses.map(c => <th key={c.id}>{c.title}{!c.isPublished && <span style={{ fontWeight: 400 }}>（非公開）</span>}</th>)}
                <th>契約会員数</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    {p.description && <div style={{ fontSize: 12, color: "var(--sub)" }}>{p.description}</div>}
                  </td>
                  {courses.map(c => (
                    <td key={c.id} style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={has(p.id, c.id)} onChange={e => s.setPlanCourse(p.id, c.id, e.target.checked)} />
                    </td>
                  ))}
                  <td>{memberCount(p.id)}名</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      const n = prompt("プラン名", p.name);
                      if (n) s.updatePlan(p.id, { name: n });
                    }}>✎ 名称</button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      if (memberCount(p.id) > 0) { alert("契約中の会員がいるプランは削除できません。先に会員のプランを変更してください。"); return; }
                      if (confirm(`プラン「${p.name}」を削除しますか？`)) s.deletePlan(p.id);
                    }}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <input className="inline" placeholder="新しいプラン名" value={planName} onChange={e => setPlanName(e.target.value)} />
          <input className="inline" style={{ width: 240 }} placeholder="説明（任意）" value={planDesc} onChange={e => setPlanDesc(e.target.value)} />
          <button className="btn btn-gold btn-sm" onClick={() => {
            if (!planName.trim()) return;
            s.addPlan(planName.trim(), planDesc.trim());
            setPlanName(""); setPlanDesc("");
          }}>＋ プランを追加</button>
        </div>
      </div>

      <div className="card">
        <h3>コース一覧</h3>
        {courses.map(c => (
          <div className="adm-row" key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 8, marginBottom: 8 }}>
            <span className="updown">
              <button onClick={() => s.moveCourse(c.id, -1)}>▲</button>{" "}
              <button onClick={() => s.moveCourse(c.id, 1)}>▼</button>
            </span>
            <div className="ttl">
              {c.title}
              {c.description && <div style={{ fontSize: 12, color: "var(--sub)", fontWeight: 400 }}>{c.description}</div>}
            </div>
            <span className={`badge ${c.isPublished ? "b-pub" : "b-draft"}`}>{c.isPublished ? "公開中" : "下書き"}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const n = prompt("コース名", c.title);
              if (n) s.updateCourse(c.id, { title: n });
            }}>✎ 名称</button>
            <button className="btn btn-ghost btn-sm" onClick={() => s.updateCourse(c.id, { isPublished: !c.isPublished })}>
              {c.isPublished ? "下書きに戻す" : "公開する"}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => {
              if (!s.deleteCourse(c.id)) alert("配下に章があるコースは削除できません。先に章・レッスンを削除してください。");
            }}>削除</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <input className="inline" placeholder="新しいコース名" value={courseName} onChange={e => setCourseName(e.target.value)} />
          <input className="inline" style={{ width: 240 }} placeholder="説明（任意）" value={courseDesc} onChange={e => setCourseDesc(e.target.value)} />
          <button className="btn btn-gold btn-sm" onClick={() => {
            if (!courseName.trim()) return;
            s.addCourse(courseName.trim(), courseDesc.trim());
            setCourseName(""); setCourseDesc("");
          }}>＋ コースを追加（下書きで作成）</button>
        </div>
      </div>
    </>
  );
}

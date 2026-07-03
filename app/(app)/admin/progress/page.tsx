"use client";
// S-09 進捗管理（会員別達成率・レッスン別集計・視聴回数。閲覧のみ）
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ProgressBar } from "@/components/ui";

export default function AdminProgressPage() {
  const s = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  if (!s.user) return null;

  const members = s.db.members.filter(m => m.role !== "admin");

  const memberLessons = (planId: string | null) => {
    const allowed = new Set(s.db.planCourses.filter(pc => pc.planId === planId).map(pc => pc.courseId));
    const secIds = new Set(s.db.sections.filter(sec => allowed.has(sec.courseId)).map(sec => sec.id));
    return s.db.lessons.filter(l => l.isPublished && secIds.has(l.sectionId));
  };

  const rows = members.map(m => {
    const lessons = memberLessons(m.planId);
    const done = lessons.filter(l => s.db.progress.some(p => p.userId === m.id && p.lessonId === l.id && p.completedAt)).length;
    const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
    const lastP = s.db.progress.filter(p => p.userId === m.id && p.watchedAt).map(p => p.watchedAt!).sort().pop();
    const myResults = s.db.quizResults.filter(r => r.userId === m.id);
    const avg = myResults.length ? (myResults.reduce((a, r) => a + r.score, 0) / myResults.length).toFixed(1) : "―";
    return { m, done, total: lessons.length, pct, last: lastP ? lastP.slice(0, 10).replace(/-/g, "/") : "―", avg };
  }).sort((a, b) => b.pct - a.pct);

  const lessonAgg = s.db.lessons.filter(l => l.isPublished).map(l => {
    const ps = s.db.progress.filter(p => p.lessonId === l.id);
    const completed = ps.filter(p => p.completedAt).length;
    const views = ps.reduce((a, p) => a + p.viewCount, 0);
    const rs = s.db.quizResults.filter(r => r.lessonId === l.id);
    const avg = rs.length ? (rs.reduce((a, r) => a + r.score, 0) / rs.length).toFixed(1) : "―";
    const attempts = new Map<string, number>();
    rs.forEach(r => attempts.set(r.userId, (attempts.get(r.userId) ?? 0) + 1));
    const avgTry = attempts.size ? ([...attempts.values()].reduce((a, b) => a + b, 0) / attempts.size).toFixed(1) : "―";
    return { l, completed, views, avg, avgTry };
  });

  const sel = members.find(m => m.id === selected);

  return (
    <>
      <div className="page-title">進捗管理</div>
      <div className="page-sub">S-09｜全会員の学習状況を確認できます（閲覧のみ）。会員名をクリックで明細を表示</div>

      <div className="card">
        <h3>会員別の達成率</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>会員</th><th>達成率</th><th>完了</th><th>最終学習日</th><th>テスト平均点</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.m.id} style={{ cursor: "pointer" }} onClick={() => setSelected(r.m.id === selected ? null : r.m.id)}>
                  <td><b style={{ textDecoration: "underline" }}>{r.m.name}</b></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 140 }}><ProgressBar pct={r.pct} height={10} /></div>{r.pct}%
                    </div>
                  </td>
                  <td>{r.done}/{r.total}</td>
                  <td>{r.last}</td>
                  <td>{r.avg} / 5</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <div className="card">
          <h3>{sel.name} さんのレッスン別明細</h3>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>レッスン</th><th>視聴回数</th><th>視聴完了日</th><th>状態</th><th>テスト（得点/受験回数）</th></tr></thead>
              <tbody>
                {memberLessons(sel.planId).map(l => {
                  const p = s.db.progress.find(x => x.userId === sel.id && x.lessonId === l.id);
                  const rs = s.db.quizResults.filter(r => r.userId === sel.id && r.lessonId === l.id);
                  const best = rs.length ? Math.max(...rs.map(r => r.score)) : null;
                  return (
                    <tr key={l.id}>
                      <td>{l.title}</td>
                      <td>{p?.viewCount ?? 0}回</td>
                      <td>{p?.watchedAt ? p.watchedAt.slice(0, 10).replace(/-/g, "/") : "―"}</td>
                      <td>{p?.completedAt ? <span className="badge b-done">完了</span> : p?.watchedAt ? <span className="badge b-watch">視聴済</span> : <span className="badge b-none">未受講</span>}</td>
                      <td>{best !== null ? `最高 ${best}/5（${rs.length}回受験）` : "―"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3>レッスン別の集計</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>レッスン</th><th>完了者数</th><th>総視聴回数</th><th>平均点</th><th>平均受験回数</th></tr></thead>
            <tbody>
              {lessonAgg.map(r => (
                <tr key={r.l.id}>
                  <td>{r.l.title}</td>
                  <td>{r.completed}名</td>
                  <td>{r.views}回</td>
                  <td>{r.avg} / 5</td>
                  <td>{r.avgTry}回</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

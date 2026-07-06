"use client";
// S-02 ダッシュボード
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { ProgressBar } from "@/components/ui";

export default function DashboardPage() {
  const s = useStore();
  const router = useRouter();
  if (!s.user) return null;

  const rate = s.overallRate();
  const lessons = s.visibleLessons();
  const next = lessons.find(l => s.stateOf(l.id) !== "done");
  const results = s.myQuizResults().slice(0, 3);
  const lessonTitle = (id: string) => s.db.lessons.find(l => l.id === id)?.title ?? "―";

  const beauty = s.theme === "beauty";
  return (
    <>
      <div className="page-en">My Dashboard</div>
      <div className="page-title">{beauty ? "今日も、じぶんを磨くじかん" : "ダッシュボード"}</div>
      <div className="page-sub">おかえりなさい、{s.user.name}さん。{beauty ? "学びの続きからご案内します。" : "今日も一歩前へ。"}</div>
      <div className="grid2">
        <div className="card" style={{ textAlign: "center" }}>
          <h3>全体達成率</h3>
          <div className="big-rate">{rate.pct}<small> %</small></div>
          <div style={{ margin: "10px 0 8px" }}><ProgressBar pct={rate.pct} /></div>
          <div style={{ fontSize: 13, color: "var(--sub)" }}>完了 {rate.done} / 全 {rate.total} レッスン</div>
          {next ? (
            <button className="btn btn-gold" style={{ marginTop: 14 }} onClick={() => router.push(`/lessons/${next.id}`)}>
              ▶ 続きから学ぶ：{next.title}
            </button>
          ) : (
            <div className="badge b-done" style={{ marginTop: 14 }}>全レッスン完了！</div>
          )}
        </div>
        <div className="card">
          <h3>コースごとの進捗</h3>
          {s.visibleCourses().map(c => {
            const r = s.courseRate(c.id);
            return (
              <div key={c.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600 }}>
                  <span>{c.title}</span><span style={{ color: "var(--sub)" }}>{r.done}/{r.total}</span>
                </div>
                <div style={{ marginTop: 4 }}><ProgressBar pct={r.pct} height={10} /></div>
              </div>
            );
          })}
          <Link href="/lessons"><span style={{ fontSize: 13, color: "var(--sub)", textDecoration: "underline" }}>コース目次を開く →</span></Link>
        </div>
      </div>
      <div className="card">
        <h3>直近のテスト結果</h3>
        {results.length ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>受験日</th><th>レッスン</th><th>得点</th><th>結果</th></tr></thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td>{r.takenAt.slice(0, 10).replace(/-/g, "/")}</td>
                    <td>{lessonTitle(r.lessonId)}</td>
                    <td>{r.score}/5</td>
                    <td>{r.passed ? <span className="badge b-done">合格</span> : <span className="badge b-draft">不合格</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: 13.5, color: "var(--sub)" }}>まだテストの受験履歴がありません。</p>
        )}
      </div>
    </>
  );
}

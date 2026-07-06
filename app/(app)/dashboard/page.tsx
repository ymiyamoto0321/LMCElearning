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
      <div className="page-title">{beauty ? "今日もわたしを磨くじかん" : "ダッシュボード"}</div>
      <div className="page-sub">おかえりなさい、{s.user.name}さん。{beauty ? "学びの続きからご案内します。" : "今日も一歩前へ。"}</div>
      <div className="grid2">
        <div className="card" style={{ textAlign: "center" }}>
          <h3>{beauty ? "全体の歩み" : "全体達成率"}<span className="h-en">Progress</span></h3>
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
          <h3>{beauty ? "コースごとの歩み" : "コースごとの進捗"}<span className="h-en">Courses</span></h3>
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
        <h3>{beauty ? "直近の確認テスト" : "直近のテスト結果"}<span className="h-en">Recent Results</span></h3>
        {results.length ? (
          beauty ? (
            /* ビューティ: デモと同じアイコン付きカード行 */
            <div>
              {results.map(r => (
                <div className="lesson-row" style={{ cursor: "default" }} key={r.id}>
                  <div className={`st ${r.passed ? "st-done" : "st-watch"}`}>{r.passed ? "✓" : "✎"}</div>
                  <div className="ttl">
                    {lessonTitle(r.lessonId)}
                    <span className="ttl-sub">
                      {new Date(r.takenAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <span className={`badge ${r.passed ? "b-done" : "b-watch"}`}>{r.score}/5 {r.passed ? "合格" : "もう一歩"}</span>
                </div>
              ))}
            </div>
          ) : (
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
          )
        ) : (
          <p style={{ fontSize: 13.5, color: "var(--sub)" }}>まだテストの受験履歴がありません。</p>
        )}
      </div>

      {/* ビューティテーマ時のみ表示される引用バンド */}
      <div className="bq">
        <span className="h-tl">♡</span><span className="h-br">♡</span>
        <div className="en">ONE STEP AT A TIME</div>
        <div className="msg">きのうの自分より、一歩だけ前へ。</div>
      </div>
    </>
  );
}

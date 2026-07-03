"use client";
// S-03 コース目次（プラン制御・検索・お気に入り）
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { StateBadge } from "@/components/ui";

export default function LessonsPage() {
  const s = useStore();
  const router = useRouter();
  const courses = s.visibleCourses();
  const [courseId, setCourseId] = useState<string>("");
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"all" | "none" | "watch" | "done">("all");
  const [favOnly, setFavOnly] = useState(false);

  if (!s.user) return null;
  if (!courses.length) {
    return (
      <>
        <div className="page-title">コース目次</div>
        <div className="card" style={{ textAlign: "center", color: "var(--sub)" }}>
          ご契約プランに公開中のコースがありません。運営までお問い合わせください。
        </div>
      </>
    );
  }

  const current = courses.find(c => c.id === courseId) ?? courses[0];
  const match = (lid: string, title: string) =>
    (!q || title.toLowerCase().includes(q.toLowerCase())) &&
    (st === "all" || s.stateOf(lid) === st) &&
    (!favOnly || s.isFav(lid));

  let hit = 0;

  return (
    <>
      <div className="page-title">コース目次</div>
      <div className="page-sub">章をクリックして学習を進めましょう（✓＝完了・♥＝お気に入り）</div>

      {courses.length > 1 && (
        <div className="course-tabs">
          {courses.map(c => (
            <button key={c.id} className={c.id === current.id ? "on" : ""} onClick={() => setCourseId(c.id)}>
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div className="search-bar">
        <input className="inline" type="text" placeholder="🔍 タイトルで検索" value={q} onChange={e => setQ(e.target.value)} />
        <label>ステータス：
          <select className="inline" value={st} onChange={e => setSt(e.target.value as typeof st)}>
            <option value="all">すべて</option>
            <option value="none">未受講</option>
            <option value="watch">視聴済・テスト未合格</option>
            <option value="done">完了</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={favOnly} onChange={e => setFavOnly(e.target.checked)} />♥ お気に入りのみ
        </label>
      </div>

      {s.sectionsOf(current.id).map(sec => {
        const all = s.lessonsOf(sec.id).filter(l => l.isPublished);
        const ls = all.filter(l => match(l.id, l.title));
        if (!ls.length) return null;
        const done = all.filter(l => s.stateOf(l.id) === "done").length;
        hit += ls.length;
        return (
          <div className="sec-block" key={sec.id}>
            <div className="sec-head"><span>{sec.title}</span><span className="cnt">{done}/{all.length} 完了</span></div>
            {ls.map(l => {
              const state = s.stateOf(l.id);
              return (
                <div className="lesson-row" key={l.id} onClick={() => router.push(`/lessons/${l.id}`)}>
                  <div className={`st st-${state}`}>{state === "done" ? "✓" : state === "watch" ? "▶" : "－"}</div>
                  <div className="ttl">{l.title}</div>
                  <button
                    className={`fav ${s.isFav(l.id) ? "on" : ""}`}
                    title="お気に入り"
                    onClick={e => { e.stopPropagation(); s.toggleFav(l.id); }}
                  >
                    {s.isFav(l.id) ? "♥" : "♡"}
                  </button>
                  <StateBadge state={state} />
                </div>
              );
            })}
          </div>
        );
      })}
      {hit === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--sub)" }}>該当するレッスンがありません</div>
      )}
    </>
  );
}

"use client";
// S-04 レッスン視聴（YouTube IFrame API: 再生開始で視聴回数+1、最後まで再生で視聴完了）
import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: {
        videoId: string;
        playerVars?: Record<string, number>;
        events?: { onStateChange?: (e: { data: number }) => void };
      }) => { destroy: () => void };
      PlayerState: { ENDED: number; PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function LessonPage() {
  const s = useStore();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const lessonId = params.id;
  const playerRef = useRef<HTMLDivElement>(null);
  const countedRef = useRef(false); // 同一ページ内の再生開始は1回のみカウント

  const lesson = s.db.lessons.find(l => l.id === lessonId);
  const inPlan = s.visibleLessons().some(l => l.id === lessonId);
  const isAdmin = s.user?.role === "admin";

  // プラン外・非公開レッスンへの直接アクセスは目次へ転送
  useEffect(() => {
    if (!s.ready || !s.user) return;
    if (!lesson || (!inPlan && !isAdmin)) router.replace("/lessons");
  }, [s.ready, s.user, lesson, inPlan, isAdmin, router]);

  // YouTube IFrame Player
  useEffect(() => {
    if (!lesson || !playerRef.current) return;
    let player: { destroy: () => void } | null = null;
    let cancelled = false;

    const create = () => {
      if (cancelled || !window.YT || !playerRef.current) return;
      player = new window.YT.Player(playerRef.current, {
        videoId: lesson.videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e) => {
            if (!window.YT) return;
            if (e.data === window.YT.PlayerState.PLAYING && !countedRef.current) {
              countedRef.current = true;
              s.recordView(lesson.id);
            }
            if (e.data === window.YT.PlayerState.ENDED) {
              s.recordWatched(lesson.id);
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      create();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); create(); };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }
    return () => { cancelled = true; player?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  if (!lesson || !s.user) return null;

  const section = s.db.sections.find(x => x.id === lesson.sectionId);
  const state = s.stateOf(lesson.id);
  const watched = state === "watch" || state === "done";
  const progress = s.progressOf(lesson.id);
  const questionCount = s.db.questions.filter(q => q.lessonId === lesson.id).length;

  // 前後ナビ（同一コース内の公開レッスン順）
  const flow = s.visibleLessons();
  const idx = flow.findIndex(l => l.id === lesson.id);
  const prev = idx > 0 ? flow[idx - 1] : null;
  const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;

  return (
    <>
      <div className="page-title">{lesson.title}</div>
      <div className="page-sub">{section?.title}</div>

      <div className="card">
        <div className="player-box"><div ref={playerRef} /></div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className={`fav ${s.isFav(lesson.id) ? "on" : ""}`}
            style={{ fontSize: 24 }}
            title="お気に入り"
            onClick={() => s.toggleFav(lesson.id)}
          >
            {s.isFav(lesson.id) ? "♥" : "♡"}
          </button>
          {watched ? <span className="badge b-done">視聴完了</span> : <span className="badge b-none">未視聴（最後まで再生すると完了になります）</span>}
          {state === "done" && <span className="badge b-done">テスト合格済</span>}
          <span className="badge b-none">視聴回数：{progress?.viewCount ?? 0}回</span>
          {lesson.pdfUrl && (
            <a href={lesson.pdfUrl} target="_blank" rel="noreferrer">
              <button className="btn btn-ghost btn-sm">📄 資料PDFをダウンロード</button>
            </a>
          )}
        </div>
        {lesson.description && <p style={{ marginTop: 10, fontSize: 14, color: "var(--sub)" }}>{lesson.description}</p>}
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        {questionCount > 0 ? (
          <>
            <button
              className={`btn ${watched ? "btn-gold" : "btn-ghost"}`}
              disabled={!watched}
              onClick={() => router.push(`/lessons/${lesson.id}/quiz`)}
            >
              ✎ 確認テストを受ける（ランダム5問・4問正解で合格）
            </button>
            {!watched && <div style={{ fontSize: 12.5, color: "var(--sub)", marginTop: 8 }}>動画を最後まで視聴するとテストが受けられます</div>}
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--sub)" }}>このレッスンに確認テストはありません（視聴完了で完了になります）</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>{prev && <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/lessons/${prev.id}`)}>← {prev.title}</button>}</div>
        <div>{next && <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/lessons/${next.id}`)}>{next.title} →</button>}</div>
      </div>
    </>
  );
}

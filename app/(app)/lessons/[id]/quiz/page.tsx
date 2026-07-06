"use client";
// S-05 確認テスト（ランダム5問・選択肢シャッフル・4問正解で合格・再挑戦無制限）
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { QUIZ_SIZE, PASS_LINE } from "@/lib/types";

interface QuizItem {
  questionText: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  selected: number | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizPage() {
  const s = useStore();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const lessonId = params.id;
  const lesson = s.db.lessons.find(l => l.id === lessonId);

  const [items, setItems] = useState<QuizItem[]>([]);
  const [graded, setGraded] = useState(false);
  const [msg, setMsg] = useState("");
  const [attempt, setAttempt] = useState(0); // 再挑戦で再抽選

  const bank = useMemo(
    () => s.db.questions.filter(q => q.lessonId === lessonId),
    [s.db.questions, lessonId]
  );

  // 出題（ランダム5問＋選択肢シャッフル）
  useEffect(() => {
    const picked = shuffle(bank).slice(0, QUIZ_SIZE);
    setItems(picked.map(q => {
      const order = shuffle(q.choices.map((_, i) => i));
      return {
        questionText: q.questionText,
        choices: order.map(i => q.choices[i]),
        correctIndex: order.indexOf(q.correctIndex),
        explanation: q.explanation,
        selected: null,
      };
    }));
    setGraded(false);
    setMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, attempt]);

  // ガード: 視聴未完了はレッスンへ転送
  const state = s.stateOf(lessonId);
  useEffect(() => {
    if (!s.ready || !s.user) return;
    if (!lesson || bank.length === 0 || state === "none") router.replace(`/lessons/${lessonId}`);
  }, [s.ready, s.user, lesson, bank.length, state, lessonId, router]);

  if (!lesson || !s.user || !items.length) return null;

  const score = items.filter(it => it.selected === it.correctIndex).length;
  const passed = score >= PASS_LINE;

  const grade = () => {
    const un = items.findIndex(it => it.selected === null);
    if (un >= 0) { setMsg(`Q${un + 1} が未回答です。すべて回答してから採点してください。`); return; }
    s.submitQuiz(lessonId, score);
    setGraded(true);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <div className="page-en">Quiz</div>
      <div className="page-title">{graded ? "テスト結果" : "確認テスト"}：{lesson.title}</div>
      <div className="page-sub">全{items.length}問中 {PASS_LINE}問正解で合格。不合格でも何度でも再挑戦できます。</div>

      {graded && (
        <div className={`result-band ${passed ? "result-pass" : "result-fail"}`}>
          <div style={{ fontSize: 14, letterSpacing: 2 }}>{passed ? "🎉 合格！レッスン完了" : "あと少し！再挑戦しましょう"}</div>
          <div className="sc">{score} <span style={{ fontSize: 18 }}>/ {items.length} 問正解</span></div>
        </div>
      )}

      {items.map((it, qi) => (
        <div className="q-card" key={qi}>
          <div className="qno">
            Q{qi + 1} / {items.length}{" "}
            {graded && (it.selected === it.correctIndex
              ? <span style={{ color: "var(--ok)" }}>○ 正解</span>
              : <span style={{ color: "var(--warn)" }}>× 不正解</span>)}
          </div>
          <div className="qtext">{it.questionText}</div>
          {it.choices.map((c, ci) => {
            const cls = graded
              ? (ci === it.correctIndex ? "ok" : ci === it.selected ? "ng" : "")
              : (ci === it.selected ? "sel" : "");
            return (
              <label className={`choice ${cls}`} key={ci}>
                {!graded && (
                  <input
                    type="radio"
                    name={`q${qi}`}
                    checked={it.selected === ci}
                    onChange={() => setItems(prev => prev.map((x, i) => i === qi ? { ...x, selected: ci } : x))}
                  />
                )}
                {c}{graded && ci === it.correctIndex ? "　✓正解" : ""}
              </label>
            );
          })}
          {graded && it.explanation && <div className="expl">💡 {it.explanation}</div>}
        </div>
      ))}

      <div style={{ textAlign: "center", marginTop: 10 }}>
        {!graded ? (
          <>
            <button className="btn btn-primary" style={{ width: "auto", padding: "12px 46px" }} onClick={grade}>採点する</button>
            {msg && <div style={{ color: "var(--warn)", fontSize: 13, marginTop: 8 }}>{msg}</div>}
          </>
        ) : (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {passed ? (
              <button className="btn btn-gold" onClick={() => router.push("/lessons")}>次のレッスンへ進む</button>
            ) : (
              <>
                <button className="btn btn-gold" onClick={() => setAttempt(a => a + 1)}>↻ 再挑戦する（問題は再抽選）</button>
                <button className="btn btn-ghost" onClick={() => router.push(`/lessons/${lessonId}`)}>動画をもう一度見る</button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

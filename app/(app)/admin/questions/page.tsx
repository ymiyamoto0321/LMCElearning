"use client";
// S-07 問題管理（レッスン別のテスト問題の登録・編集・削除）
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Modal } from "@/components/ui";
import { Question } from "@/lib/types";

interface QForm { questionText: string; choices: string[]; correctIndex: number; explanation: string; }
const emptyQ: QForm = { questionText: "", choices: ["", "", "", ""], correctIndex: 0, explanation: "" };

export default function AdminQuestionsPage() {
  const s = useStore();
  const lessons = s.db.lessons;
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [editing, setEditing] = useState<Question | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<QForm>(emptyQ);
  const [err, setErr] = useState("");

  if (!s.user) return null;
  const qs = s.db.questions.filter(q => q.lessonId === lessonId);

  const save = () => {
    if (!form.questionText.trim()) { setErr("問題文は必須です。"); return; }
    if (form.choices.some(c => !c.trim())) { setErr("選択肢は4つすべて入力してください。"); return; }
    if (editing) s.updateQuestion(editing.id, { ...form });
    else s.addQuestion({ lessonId, ...form });
    setEditing(null); setAdding(false);
  };

  return (
    <>
      <div className="page-title">問題管理</div>
      <div className="page-sub">S-07｜レッスンごとにテスト問題を登録します（ランダム性確保のため8問以上推奨・最低5問）</div>

      <div className="card">
        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--sub)" }}>対象レッスン：</label>{" "}
        <select className="inline" value={lessonId} onChange={e => setLessonId(e.target.value)}>
          {lessons.map(l => (
            <option key={l.id} value={l.id}>
              {l.title}（{s.db.questions.filter(q => q.lessonId === l.id).length}問）
            </option>
          ))}
        </select>{" "}
        <button className="btn btn-gold btn-sm" onClick={() => { setForm(emptyQ); setErr(""); setAdding(true); }}>＋ 問題を追加</button>
        {qs.length < 5 && <span className="badge b-draft" style={{ marginLeft: 10 }}>登録が5問未満です</span>}
      </div>

      {qs.length ? (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{ width: "46%" }}>問題文</th><th>正解</th><th style={{ width: 150 }}>操作</th></tr></thead>
            <tbody>
              {qs.map(q => (
                <tr key={q.id}>
                  <td>{q.questionText}</td>
                  <td>{q.choices[q.correctIndex]}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setForm({ questionText: q.questionText, choices: [...q.choices], correctIndex: q.correctIndex, explanation: q.explanation });
                      setErr(""); setEditing(q);
                    }}>✎ 編集</button>{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => { if (confirm("この問題を削除しますか？")) s.deleteQuestion(q.id); }}>削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ textAlign: "center", color: "var(--sub)" }}>このレッスンにはまだ問題が登録されていません</div>
      )}

      {(adding || editing) && (
        <Modal title={editing ? "問題を編集" : "問題を追加"} onClose={() => { setAdding(false); setEditing(null); }}>
          {err && <div className="login-err">{err}</div>}
          <div className="field"><label>問題文（必須）</label>
            <input value={form.questionText} onChange={e => setForm({ ...form, questionText: e.target.value })} /></div>
          {form.choices.map((c, i) => (
            <div className="field" key={i}>
              <label>
                選択肢{i + 1}（必須）{" "}
                <input type="radio" name="correct" checked={form.correctIndex === i} onChange={() => setForm({ ...form, correctIndex: i })} /> 正解
              </label>
              <input value={c} onChange={e => setForm({ ...form, choices: form.choices.map((x, j) => j === i ? e.target.value : x) })} />
            </div>
          ))}
          <div className="field"><label>解説（任意・結果画面に表示）</label>
            <input value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} /></div>
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => { setAdding(false); setEditing(null); }}>キャンセル</button>
            <button className="btn btn-gold" onClick={save}>保存</button>
          </div>
        </Modal>
      )}
    </>
  );
}

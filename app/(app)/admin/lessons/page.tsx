"use client";
// S-06 レッスン管理（コース＞章＞レッスン。追加・編集・削除・並べ替え・公開切替・検索）
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Modal } from "@/components/ui";
import { Lesson, extractVideoId } from "@/lib/types";

interface LessonForm { title: string; description: string; videoUrl: string; pdfUrl: string; }
const emptyForm: LessonForm = { title: "", description: "", videoUrl: "", pdfUrl: "" };

export default function AdminLessonsPage() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [pub, setPub] = useState<"all" | "pub" | "draft">("all");
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null); // sectionId
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const [err, setErr] = useState("");

  if (!s.user) return null;

  const match = (l: Lesson) =>
    (!q || l.title.toLowerCase().includes(q.toLowerCase())) &&
    (pub === "all" || (pub === "pub") === l.isPublished);

  const openAdd = (sectionId: string) => { setForm(emptyForm); setErr(""); setAddingTo(sectionId); };
  const openEdit = (l: Lesson) => {
    setForm({ title: l.title, description: l.description, videoUrl: l.videoId, pdfUrl: l.pdfUrl });
    setErr(""); setEditing(l);
  };
  const save = () => {
    if (!form.title.trim()) { setErr("タイトルは必須です。"); return; }
    const vid = extractVideoId(form.videoUrl);
    if (!vid) { setErr("YouTubeのURL（youtu.be／youtube.com/watch）またはGoogle DriveのURL（drive.google.com/file/d/...）を入力してください。"); return; }
    const data = { title: form.title.trim(), description: form.description, videoId: vid, pdfUrl: form.pdfUrl.trim() };
    if (editing) s.updateLesson(editing.id, data);
    else if (addingTo) s.addLesson(addingTo, data);
    setEditing(null); setAddingTo(null);
  };

  const filtering = q !== "" || pub !== "all";

  return (
    <>
      <div className="page-title">レッスン管理</div>
      <div className="page-sub">S-06｜章・レッスンの追加、並べ替え（▲▼）、公開切替、タイトル変更ができます</div>

      <div className="search-bar">
        <input className="inline" type="text" placeholder="🔍 タイトルで検索" value={q} onChange={e => setQ(e.target.value)} />
        <label>公開状態：
          <select className="inline" value={pub} onChange={e => setPub(e.target.value as typeof pub)}>
            <option value="all">すべて</option>
            <option value="pub">公開中</option>
            <option value="draft">下書き</option>
          </select>
        </label>
      </div>

      {[...s.db.courses].sort((a, b) => a.sortOrder - b.sortOrder).map(course => (
        <div key={course.id} style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>
            📚 {course.title}
            {!course.isPublished && <span className="badge b-draft" style={{ marginLeft: 8 }}>コース非公開</span>}
          </div>
          {s.sectionsOf(course.id).map(sec => {
            const ls = s.lessonsOf(sec.id).filter(match);
            if (filtering && !ls.length) return null;
            return (
              <div className="sec-block" key={sec.id}>
                <div className="sec-head">
                  <span>{sec.title}</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <span className="updown">
                      <button onClick={() => s.moveSection(sec.id, -1)}>▲</button>{" "}
                      <button onClick={() => s.moveSection(sec.id, 1)}>▼</button>
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      const t = prompt("章タイトルを編集", sec.title);
                      if (t) s.updateSection(sec.id, { title: t });
                    }}>章名変更</button>
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      if (!s.deleteSection(sec.id)) alert("配下にレッスンがある章は削除できません。先にレッスンを削除・移動してください。");
                    }}>章を削除</button>
                  </span>
                </div>
                {ls.map(l => {
                  const qn = s.db.questions.filter(x => x.lessonId === l.id).length;
                  return (
                    <div className="adm-row" key={l.id}>
                      <span className="updown">
                        <button onClick={() => s.moveLesson(l.id, -1)}>▲</button>{" "}
                        <button onClick={() => s.moveLesson(l.id, 1)}>▼</button>
                      </span>
                      <div className="ttl">{l.title}</div>
                      <span className={`badge ${l.isPublished ? "b-pub" : "b-draft"}`}>{l.isPublished ? "公開中" : "下書き"}</span>
                      <span className={`badge ${qn >= 5 ? "b-none" : "b-draft"}`}>問題 {qn}問{qn < 5 ? "（要追加）" : ""}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(l)}>✎ 編集</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => s.updateLesson(l.id, { isPublished: !l.isPublished })}>
                        {l.isPublished ? "下書きに戻す" : "公開する"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => {
                        if (confirm(`「${l.title}」を削除しますか？\n※会員の視聴記録・テスト結果・お気に入りも削除されます`)) s.deleteLesson(l.id);
                      }}>削除</button>
                    </div>
                  );
                })}
                <div className="adm-row" style={{ justifyContent: "center" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openAdd(sec.id)}>＋ レッスンを追加</button>
                </div>
              </div>
            );
          })}
          <button className="btn btn-ghost btn-sm" onClick={() => {
            const t = prompt(`「${course.title}」に追加する章のタイトル`);
            if (t) s.addSection(course.id, t);
          }}>＋ 章を追加</button>
        </div>
      ))}
      <p style={{ fontSize: 12.5, color: "var(--sub)" }}>コースの追加・並べ替えは「プラン・コース管理」で行います。</p>

      {(editing || addingTo) && (
        <Modal title={editing ? "レッスンを編集" : "レッスンを追加"} onClose={() => { setEditing(null); setAddingTo(null); }}>
          {err && <div className="login-err">{err}</div>}
          <div className="field"><label>タイトル（必須）</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label>説明</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="field"><label>YouTube動画URL（限定公開・必須）</label>
            <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtu.be/XXXXXXXXXXX" /></div>
          <div className="field"><label>資料PDFのURL（任意）</label>
            <input value={form.pdfUrl} onChange={e => setForm({ ...form, pdfUrl: e.target.value })} placeholder="https://..." /></div>
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => { setEditing(null); setAddingTo(null); }}>キャンセル</button>
            <button className="btn btn-gold" onClick={save}>{editing ? "保存" : "追加（下書きで作成）"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

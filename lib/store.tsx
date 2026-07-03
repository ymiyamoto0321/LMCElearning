"use client";
// アプリ全体の状態管理（ハイブリッド）
// - .env.local に Supabase の URL / anonキーが設定されていれば「本接続モード」
//   （認証=Supabase Auth、データ=PostgreSQL+RLS。権限制御はDB側でも担保）
// - 未設定なら「デモモード」（localStorage保存・デモアカウントで動作）
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  Member, Plan, PlanCourse, Course, Section, Lesson, Question, Progress, QuizResult, Favorite,
  Theme, Role, MemberStatus, PASS_LINE,
} from "./types";
import {
  demoMembers, demoPlans, demoPlanCourses, demoCourses, demoSections, demoLessons,
  demoQuestions, demoProgress, demoQuizResults, demoFavorites,
} from "./demo-data";
import { getSupabase } from "./supabase";

const LS_KEY = "lmc-elearning-demo-v1";

interface DB {
  members: Member[];
  plans: Plan[];
  planCourses: PlanCourse[];
  courses: Course[];
  sections: Section[];
  lessons: Lesson[];
  questions: Question[];
  progress: Progress[];
  quizResults: QuizResult[];
  favorites: Favorite[];
}

const emptyDB: DB = {
  members: [], plans: [], planCourses: [], courses: [], sections: [],
  lessons: [], questions: [], progress: [], quizResults: [], favorites: [],
};
const initialDemoDB: DB = {
  members: demoMembers, plans: demoPlans, planCourses: demoPlanCourses, courses: demoCourses,
  sections: demoSections, lessons: demoLessons, questions: demoQuestions,
  progress: demoProgress, quizResults: demoQuizResults, favorites: demoFavorites,
};

export type OpResult = { ok: true } | { ok: false; message: string };

/* ---------- DB行（snake_case）⇔ アプリ型（camelCase）の変換 ---------- */
type Row = Record<string, unknown>;
const str = (v: unknown) => (v as string) ?? "";
const rowToMember = (r: Row): Member => ({
  id: str(r.id), name: str(r.name), email: str(r.email),
  role: (r.role as Role) ?? "member", status: (r.status as MemberStatus) ?? "active",
  planId: (r.plan_id as string) ?? null, expiresAt: str(r.expires_at),
  theme: (r.theme as Theme) ?? "standard", lastLoginAt: str(r.last_login_at), createdAt: str(r.created_at),
});
const rowToPlan = (r: Row): Plan => ({ id: str(r.id), name: str(r.name), description: str(r.description), sortOrder: (r.sort_order as number) ?? 0 });
const rowToPlanCourse = (r: Row): PlanCourse => ({ planId: str(r.plan_id), courseId: str(r.course_id) });
const rowToCourse = (r: Row): Course => ({ id: str(r.id), title: str(r.title), description: str(r.description), sortOrder: (r.sort_order as number) ?? 0, isPublished: !!r.is_published });
const rowToSection = (r: Row): Section => ({ id: str(r.id), courseId: str(r.course_id), title: str(r.title), sortOrder: (r.sort_order as number) ?? 0 });
const rowToLesson = (r: Row): Lesson => ({
  id: str(r.id), sectionId: str(r.section_id), title: str(r.title), description: str(r.description),
  videoId: str(r.video_id), pdfUrl: str(r.pdf_url), sortOrder: (r.sort_order as number) ?? 0, isPublished: !!r.is_published,
});
const rowToQuestion = (r: Row): Question => ({
  id: str(r.id), lessonId: str(r.lesson_id), questionText: str(r.question_text),
  choices: (r.choices as string[]) ?? ["", "", "", ""], correctIndex: (r.correct_index as number) ?? 0, explanation: str(r.explanation),
});
const rowToProgress = (r: Row): Progress => ({
  userId: str(r.user_id), lessonId: str(r.lesson_id), viewCount: (r.view_count as number) ?? 0,
  watchedAt: (r.watched_at as string) ?? null, completedAt: (r.completed_at as string) ?? null,
});
const rowToQuizResult = (r: Row): QuizResult => ({
  id: str(r.id), userId: str(r.user_id), lessonId: str(r.lesson_id),
  score: (r.score as number) ?? 0, passed: !!r.passed, takenAt: str(r.taken_at),
});
const rowToFavorite = (r: Row): Favorite => ({ userId: str(r.user_id), lessonId: str(r.lesson_id) });

interface Store {
  db: DB;
  user: Member | null;
  ready: boolean;
  isLive: boolean; // true=Supabase接続 / false=デモモード
  theme: Theme;
  setTheme: (t: Theme) => void;
  login: (email: string, password: string) => Promise<OpResult>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<OpResult>;
  // 会員側
  visibleCourses: () => Course[];
  sectionsOf: (courseId: string) => Section[];
  lessonsOf: (sectionId: string) => Lesson[];
  visibleLessons: () => Lesson[];
  progressOf: (lessonId: string) => Progress | undefined;
  stateOf: (lessonId: string) => "none" | "watch" | "done";
  overallRate: () => { done: number; total: number; pct: number };
  courseRate: (courseId: string) => { done: number; total: number; pct: number };
  recordView: (lessonId: string) => void;
  recordWatched: (lessonId: string) => void;
  submitQuiz: (lessonId: string, score: number) => boolean;
  isFav: (lessonId: string) => boolean;
  toggleFav: (lessonId: string) => void;
  myQuizResults: () => QuizResult[];
  // 管理側
  addSection: (courseId: string, title: string) => void;
  updateSection: (id: string, patch: Partial<Section>) => void;
  deleteSection: (id: string) => boolean;
  moveSection: (id: string, dir: -1 | 1) => void;
  addLesson: (sectionId: string, data: { title: string; description: string; videoId: string; pdfUrl: string }) => void;
  updateLesson: (id: string, patch: Partial<Lesson>) => void;
  deleteLesson: (id: string) => void;
  moveLesson: (id: string, dir: -1 | 1) => void;
  addQuestion: (q: Omit<Question, "id">) => void;
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  deleteQuestion: (id: string) => void;
  addMember: (m: Omit<Member, "id" | "role" | "lastLoginAt" | "createdAt">, password: string) => Promise<OpResult>;
  updateMember: (id: string, patch: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  resetMemberPassword: (id: string, newPassword: string) => Promise<OpResult>;
  addPlan: (name: string, description: string) => void;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  deletePlan: (id: string) => boolean;
  setPlanCourse: (planId: string, courseId: string, on: boolean) => void;
  addCourse: (title: string, description: string) => void;
  updateCourse: (id: string, patch: Partial<Course>) => void;
  deleteCourse: (id: string) => boolean;
  moveCourse: (id: string, dir: -1 | 1) => void;
}

const StoreContext = createContext<Store | null>(null);

const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const logErr = (op: string) => (e: unknown) => console.error(`[store] ${op} failed:`, e);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const isLive = !!supabase;
  const [db, setDb] = useState<DB>(isLive ? emptyDB : initialDemoDB);
  const [user, setUser] = useState<Member | null>(null);
  const [theme, setThemeState] = useState<Theme>("standard");
  const [ready, setReady] = useState(false);
  const userRef = useRef<Member | null>(null);
  userRef.current = user;

  /* ---------- 起動時: セッション復元 ---------- */
  const loadAll = useCallback(async (): Promise<DB> => {
    if (!supabase) return emptyDB;
    const [members, plans, planCourses, courses, sections, lessons, questions, progress, quizResults, favorites] =
      await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("plans").select("*"),
        supabase.from("plan_courses").select("*"),
        supabase.from("courses").select("*"),
        supabase.from("sections").select("*"),
        supabase.from("lessons").select("*"),
        supabase.from("questions").select("*"),
        supabase.from("progress").select("*"),
        supabase.from("quiz_results").select("*"),
        supabase.from("favorites").select("*"),
      ]);
    return {
      members: (members.data ?? []).map(rowToMember),
      plans: (plans.data ?? []).map(rowToPlan),
      planCourses: (planCourses.data ?? []).map(rowToPlanCourse),
      courses: (courses.data ?? []).map(rowToCourse),
      sections: (sections.data ?? []).map(rowToSection),
      lessons: (lessons.data ?? []).map(rowToLesson),
      questions: (questions.data ?? []).map(rowToQuestion),
      progress: (progress.data ?? []).map(rowToProgress),
      quizResults: (quizResults.data ?? []).map(rowToQuizResult),
      favorites: (favorites.data ?? []).map(rowToFavorite),
    };
  }, [supabase]);

  useEffect(() => {
    (async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const next = await loadAll();
          const me = next.members.find(m => m.id === data.session!.user.id) ?? null;
          // セッション復元時も有効期限・停止を検査
          if (me && me.status === "active" && (me.role === "admin" || me.expiresAt >= todayStr())) {
            setDb(next); setUser(me); setThemeState(me.theme);
          } else {
            await supabase.auth.signOut();
          }
        }
      } else {
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved.db) setDb(saved.db);
            if (saved.userId) {
              const u = ((saved.db as DB) ?? initialDemoDB).members.find((m: Member) => m.id === saved.userId) || null;
              if (u) { setUser(u); setThemeState(u.theme); }
            }
          }
        } catch { /* 破損時は初期データで開始 */ }
      }
      setReady(true);
    })();
  }, [supabase, loadAll]);

  /* ---------- 状態更新（デモ=localStorage保存 / 本接続=remote関数を実行） ---------- */
  const persist = useCallback((nextDb: DB, nextUser: Member | null) => {
    if (isLive) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ db: nextDb, userId: nextUser?.id ?? null })); } catch { /* noop */ }
  }, [isLive]);

  const update = useCallback((fn: (d: DB) => DB, remote?: () => PromiseLike<unknown>) => {
    setDb(prev => {
      const next = fn(prev);
      persist(next, userRef.current);
      return next;
    });
    if (isLive && remote) Promise.resolve(remote()).catch(logErr("update"));
  }, [persist, isLive]);

  /* ---------- 認証 ---------- */
  const login = async (email: string, password: string): Promise<OpResult> => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return { ok: false, message: "メールアドレスまたはパスワードが正しくありません。" };
      const next = await loadAll();
      const me = next.members.find(m => m.id === data.user.id) ?? null;
      if (!me) { await supabase.auth.signOut(); return { ok: false, message: "会員情報が見つかりません。運営までご連絡ください。" }; }
      if (me.status === "suspended") { await supabase.auth.signOut(); return { ok: false, message: "このアカウントは停止中です。運営までご連絡ください。" }; }
      if (me.role !== "admin" && me.expiresAt < todayStr()) {
        await supabase.auth.signOut();
        return { ok: false, message: `ご利用期限（${me.expiresAt.replace(/-/g, "/")}）を過ぎているため、ログインできません。継続をご希望の場合は運営（info@life-m-c.com）までご連絡ください。` };
      }
      supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", me.id).then(undefined, logErr("last_login"));
      setDb(next); setUser(me); setThemeState(me.theme);
      return { ok: true };
    }
    // デモモード
    const m = db.members.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!m) return { ok: false, message: "メールアドレスまたはパスワードが正しくありません。" };
    if (m.status === "suspended") return { ok: false, message: "このアカウントは停止中です。運営までご連絡ください。" };
    if (m.role !== "admin" && m.expiresAt < todayStr()) {
      return { ok: false, message: `ご利用期限（${m.expiresAt.replace(/-/g, "/")}）を過ぎているため、ログインできません。継続をご希望の場合は運営（info@life-m-c.com）までご連絡ください。` };
    }
    const logged = { ...m, lastLoginAt: new Date().toISOString() };
    const nextDb = { ...db, members: db.members.map(x => x.id === m.id ? logged : x) };
    setDb(nextDb); setUser(logged); setThemeState(logged.theme); persist(nextDb, logged);
    return { ok: true };
  };

  const logout = () => {
    if (supabase) supabase.auth.signOut();
    setUser(null);
    if (isLive) setDb(emptyDB); else persist(db, null);
  };

  const requestPasswordReset = async (email: string) => {
    if (!supabase) return; // デモモードは画面フローのみ
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/update`,
    }).catch(logErr("resetPasswordForEmail"));
  };

  const updatePassword = async (newPassword: string): Promise<OpResult> => {
    if (!supabase) return { ok: true };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? { ok: false, message: "パスワードを更新できませんでした: " + error.message } : { ok: true };
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    const u = userRef.current;
    if (!u) return;
    const nu = { ...u, theme: t };
    setUser(nu);
    update(
      d => ({ ...d, members: d.members.map(m => m.id === u.id ? nu : m) }),
      () => supabase!.from("profiles").update({ theme: t }).eq("id", u.id),
    );
  };

  /* ---------- 会員側ヘルパー ---------- */
  const visibleCourses = (): Course[] => {
    const pub = db.courses.filter(c => c.isPublished).sort((a, b) => a.sortOrder - b.sortOrder);
    if (!user) return [];
    if (user.role === "admin") return pub;
    const allowed = new Set(db.planCourses.filter(pc => pc.planId === user.planId).map(pc => pc.courseId));
    return pub.filter(c => allowed.has(c.id));
  };
  const sectionsOf = (courseId: string) =>
    db.sections.filter(s => s.courseId === courseId).sort((a, b) => a.sortOrder - b.sortOrder);
  const lessonsOf = (sectionId: string) =>
    db.lessons.filter(l => l.sectionId === sectionId).sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleLessons = (): Lesson[] => {
    const secIds = new Set(visibleCourses().flatMap(c => sectionsOf(c.id).map(s => s.id)));
    return db.lessons.filter(l => l.isPublished && secIds.has(l.sectionId)).sort((a, b) => a.sortOrder - b.sortOrder);
  };
  const progressOf = (lessonId: string) =>
    user ? db.progress.find(p => p.userId === user.id && p.lessonId === lessonId) : undefined;
  const stateOf = (lessonId: string): "none" | "watch" | "done" => {
    const p = progressOf(lessonId);
    if (!p) return "none";
    if (p.completedAt) return "done";
    if (p.watchedAt) return "watch";
    return "none";
  };
  const rateOf = (lessons: Lesson[]) => {
    const done = lessons.filter(l => stateOf(l.id) === "done").length;
    return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
  };
  const overallRate = () => rateOf(visibleLessons());
  const courseRate = (courseId: string) => {
    const secIds = new Set(sectionsOf(courseId).map(s => s.id));
    return rateOf(visibleLessons().filter(l => secIds.has(l.sectionId)));
  };

  const upsertProgress = (lessonId: string, patch: (p: Progress) => Progress) => {
    const u = userRef.current;
    if (!u) return;
    const exists = db.progress.find(p => p.userId === u.id && p.lessonId === lessonId);
    const base: Progress = exists ?? { userId: u.id, lessonId, viewCount: 0, watchedAt: null, completedAt: null };
    const next = patch(base);
    update(
      d => ({
        ...d,
        progress: d.progress.some(p => p.userId === u.id && p.lessonId === lessonId)
          ? d.progress.map(p => (p.userId === u.id && p.lessonId === lessonId ? next : p))
          : [...d.progress, next],
      }),
      () => supabase!.from("progress").upsert({
        user_id: u.id, lesson_id: lessonId, view_count: next.viewCount,
        watched_at: next.watchedAt, completed_at: next.completedAt, updated_at: new Date().toISOString(),
      }),
    );
  };

  const recordView = (lessonId: string) =>
    upsertProgress(lessonId, p => ({ ...p, viewCount: p.viewCount + 1 }));

  const recordWatched = (lessonId: string) =>
    upsertProgress(lessonId, p => {
      const watched = { ...p, watchedAt: p.watchedAt ?? new Date().toISOString() };
      const hasQuiz = db.questions.some(q => q.lessonId === lessonId);
      return hasQuiz ? watched : { ...watched, completedAt: watched.completedAt ?? new Date().toISOString() };
    });

  const submitQuiz = (lessonId: string, score: number): boolean => {
    const u = userRef.current;
    if (!u) return false;
    const passed = score >= PASS_LINE;
    const result: QuizResult = { id: uid("r"), userId: u.id, lessonId, score, passed, takenAt: new Date().toISOString() };
    update(
      d => ({ ...d, quizResults: [...d.quizResults, result] }),
      () => supabase!.from("quiz_results").insert({ user_id: u.id, lesson_id: lessonId, score, passed }),
    );
    if (passed) upsertProgress(lessonId, p => ({ ...p, completedAt: p.completedAt ?? new Date().toISOString() }));
    return passed;
  };

  const isFav = (lessonId: string) =>
    !!user && db.favorites.some(f => f.userId === user.id && f.lessonId === lessonId);
  const toggleFav = (lessonId: string) => {
    const u = userRef.current;
    if (!u) return;
    const on = !db.favorites.some(f => f.userId === u.id && f.lessonId === lessonId);
    update(
      d => ({
        ...d,
        favorites: on
          ? [...d.favorites, { userId: u.id, lessonId }]
          : d.favorites.filter(f => !(f.userId === u.id && f.lessonId === lessonId)),
      }),
      () => on
        ? supabase!.from("favorites").insert({ user_id: u.id, lesson_id: lessonId })
        : supabase!.from("favorites").delete().eq("user_id", u.id).eq("lesson_id", lessonId),
    );
  };
  const myQuizResults = () =>
    user ? db.quizResults.filter(r => r.userId === user.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt)) : [];

  /* ---------- 管理側 ---------- */
  const swapOrder = (table: "sections" | "lessons" | "courses", aId: string, aOrder: number, bId: string, bOrder: number) =>
    async () => {
      await supabase!.from(table).update({ sort_order: bOrder }).eq("id", aId);
      await supabase!.from(table).update({ sort_order: aOrder }).eq("id", bId);
    };

  const addSection = (courseId: string, title: string) => {
    const sortOrder = Math.max(0, ...db.sections.filter(s => s.courseId === courseId).map(s => s.sortOrder)) + 1;
    if (isLive) {
      supabase!.from("sections").insert({ course_id: courseId, title, sort_order: sortOrder }).select().single()
        .then(({ data }) => { if (data) setDb(d => ({ ...d, sections: [...d.sections, rowToSection(data)] })); }, logErr("addSection"));
      return;
    }
    update(d => ({ ...d, sections: [...d.sections, { id: uid("s"), courseId, title, sortOrder }] }));
  };
  const updateSection = (id: string, patch: Partial<Section>) =>
    update(
      d => ({ ...d, sections: d.sections.map(s => s.id === id ? { ...s, ...patch } : s) }),
      () => supabase!.from("sections").update({ ...(patch.title !== undefined && { title: patch.title }) }).eq("id", id),
    );
  const deleteSection = (id: string): boolean => {
    if (db.lessons.some(l => l.sectionId === id)) return false;
    update(
      d => ({ ...d, sections: d.sections.filter(s => s.id !== id) }),
      () => supabase!.from("sections").delete().eq("id", id),
    );
    return true;
  };
  const moveSection = (id: string, dir: -1 | 1) => {
    const s = db.sections.find(x => x.id === id); if (!s) return;
    const arr = db.sections.filter(x => x.courseId === s.courseId).sort((a, b) => a.sortOrder - b.sortOrder);
    const i = arr.findIndex(x => x.id === id); const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const a = arr[i], b = arr[j];
    update(
      d => ({ ...d, sections: d.sections.map(x => x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x) }),
      swapOrder("sections", a.id, a.sortOrder, b.id, b.sortOrder),
    );
  };

  const addLesson = (sectionId: string, data: { title: string; description: string; videoId: string; pdfUrl: string }) => {
    const sortOrder = Math.max(0, ...db.lessons.filter(l => l.sectionId === sectionId).map(l => l.sortOrder)) + 1;
    if (isLive) {
      supabase!.from("lessons").insert({
        section_id: sectionId, title: data.title, description: data.description,
        video_id: data.videoId, pdf_url: data.pdfUrl, sort_order: sortOrder, is_published: false,
      }).select().single()
        .then(({ data: row }) => { if (row) setDb(d => ({ ...d, lessons: [...d.lessons, rowToLesson(row)] })); }, logErr("addLesson"));
      return;
    }
    update(d => ({ ...d, lessons: [...d.lessons, { id: uid("l"), sectionId, ...data, isPublished: false, sortOrder }] }));
  };
  const updateLesson = (id: string, patch: Partial<Lesson>) =>
    update(
      d => ({ ...d, lessons: d.lessons.map(l => l.id === id ? { ...l, ...patch } : l) }),
      () => {
        const row: Row = { updated_at: new Date().toISOString() };
        if (patch.title !== undefined) row.title = patch.title;
        if (patch.description !== undefined) row.description = patch.description;
        if (patch.videoId !== undefined) row.video_id = patch.videoId;
        if (patch.pdfUrl !== undefined) row.pdf_url = patch.pdfUrl;
        if (patch.isPublished !== undefined) row.is_published = patch.isPublished;
        if (patch.sectionId !== undefined) row.section_id = patch.sectionId;
        return supabase!.from("lessons").update(row).eq("id", id);
      },
    );
  const deleteLesson = (id: string) =>
    update(
      d => ({
        ...d,
        lessons: d.lessons.filter(l => l.id !== id),
        questions: d.questions.filter(q => q.lessonId !== id),
        progress: d.progress.filter(p => p.lessonId !== id),
        quizResults: d.quizResults.filter(r => r.lessonId !== id),
        favorites: d.favorites.filter(f => f.lessonId !== id),
      }),
      () => supabase!.from("lessons").delete().eq("id", id), // 関連は on delete cascade
    );
  const moveLesson = (id: string, dir: -1 | 1) => {
    const l = db.lessons.find(x => x.id === id); if (!l) return;
    const arr = db.lessons.filter(x => x.sectionId === l.sectionId).sort((a, b) => a.sortOrder - b.sortOrder);
    const i = arr.findIndex(x => x.id === id); const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const a = arr[i], b = arr[j];
    update(
      d => ({ ...d, lessons: d.lessons.map(x => x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x) }),
      swapOrder("lessons", a.id, a.sortOrder, b.id, b.sortOrder),
    );
  };

  const addQuestion = (q: Omit<Question, "id">) => {
    if (isLive) {
      supabase!.from("questions").insert({
        lesson_id: q.lessonId, question_text: q.questionText, choices: q.choices,
        correct_index: q.correctIndex, explanation: q.explanation,
      }).select().single()
        .then(({ data }) => { if (data) setDb(d => ({ ...d, questions: [...d.questions, rowToQuestion(data)] })); }, logErr("addQuestion"));
      return;
    }
    update(d => ({ ...d, questions: [...d.questions, { ...q, id: uid("q") }] }));
  };
  const updateQuestion = (id: string, patch: Partial<Question>) =>
    update(
      d => ({ ...d, questions: d.questions.map(q => q.id === id ? { ...q, ...patch } : q) }),
      () => {
        const row: Row = {};
        if (patch.questionText !== undefined) row.question_text = patch.questionText;
        if (patch.choices !== undefined) row.choices = patch.choices;
        if (patch.correctIndex !== undefined) row.correct_index = patch.correctIndex;
        if (patch.explanation !== undefined) row.explanation = patch.explanation;
        return supabase!.from("questions").update(row).eq("id", id);
      },
    );
  const deleteQuestion = (id: string) =>
    update(
      d => ({ ...d, questions: d.questions.filter(q => q.id !== id) }),
      () => supabase!.from("questions").delete().eq("id", id),
    );

  /* 会員発行・仮PW再発行はサーバーAPI経由（service_roleキーが必要なため） */
  const adminApi = async (method: string, body: Row): Promise<OpResult> => {
    const { data } = await supabase!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, message: "セッションが切れています。再ログインしてください。" };
    const res = await fetch("/api/admin/members", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: json.error ?? "処理に失敗しました。" };
    return { ok: true };
  };

  const addMember = async (m: Omit<Member, "id" | "role" | "lastLoginAt" | "createdAt">, password: string): Promise<OpResult> => {
    if (db.members.some(x => x.email.toLowerCase() === m.email.toLowerCase()))
      return { ok: false, message: "このメールアドレスは既に登録されています。" };
    if (isLive) {
      const r = await adminApi("POST", {
        name: m.name, email: m.email, password,
        plan_id: m.planId, expires_at: m.expiresAt, theme: m.theme,
      });
      if (!r.ok) return r;
      const next = await loadAll();
      setDb(next);
      return { ok: true };
    }
    update(d => ({ ...d, members: [...d.members, { ...m, id: uid("u"), role: "member", lastLoginAt: "", createdAt: todayStr() }] }));
    return { ok: true };
  };

  const updateMember = (id: string, patch: Partial<Member>) =>
    update(
      d => ({ ...d, members: d.members.map(m => m.id === id ? { ...m, ...patch } : m) }),
      () => {
        const row: Row = {};
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.status !== undefined) row.status = patch.status;
        if (patch.planId !== undefined) row.plan_id = patch.planId;
        if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;
        if (patch.theme !== undefined) row.theme = patch.theme;
        return supabase!.from("profiles").update(row).eq("id", id);
      },
    );

  const deleteMember = (id: string) => {
    if (isLive) {
      adminApi("DELETE", { user_id: id }).then(r => {
        if (r.ok) setDb(d => ({
          ...d,
          members: d.members.filter(m => m.id !== id),
          progress: d.progress.filter(p => p.userId !== id),
          quizResults: d.quizResults.filter(x => x.userId !== id),
          favorites: d.favorites.filter(f => f.userId !== id),
        }));
        else alert(r.message);
      });
      return;
    }
    update(d => ({
      ...d,
      members: d.members.filter(m => m.id !== id),
      progress: d.progress.filter(p => p.userId !== id),
      quizResults: d.quizResults.filter(r => r.userId !== id),
      favorites: d.favorites.filter(f => f.userId !== id),
    }));
  };

  const resetMemberPassword = async (id: string, newPassword: string): Promise<OpResult> => {
    if (!isLive) return { ok: true };
    return adminApi("PATCH", { user_id: id, password: newPassword });
  };

  const addPlan = (name: string, description: string) => {
    const sortOrder = Math.max(0, ...db.plans.map(p => p.sortOrder)) + 1;
    if (isLive) {
      supabase!.from("plans").insert({ name, description, sort_order: sortOrder }).select().single()
        .then(({ data }) => { if (data) setDb(d => ({ ...d, plans: [...d.plans, rowToPlan(data)] })); }, logErr("addPlan"));
      return;
    }
    update(d => ({ ...d, plans: [...d.plans, { id: uid("p"), name, description, sortOrder }] }));
  };
  const updatePlan = (id: string, patch: Partial<Plan>) =>
    update(
      d => ({ ...d, plans: d.plans.map(p => p.id === id ? { ...p, ...patch } : p) }),
      () => {
        const row: Row = {};
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.description !== undefined) row.description = patch.description;
        return supabase!.from("plans").update(row).eq("id", id);
      },
    );
  const deletePlan = (id: string): boolean => {
    if (db.members.some(m => m.planId === id)) return false;
    update(
      d => ({ ...d, plans: d.plans.filter(p => p.id !== id), planCourses: d.planCourses.filter(pc => pc.planId !== id) }),
      () => supabase!.from("plans").delete().eq("id", id),
    );
    return true;
  };
  const setPlanCourse = (planId: string, courseId: string, on: boolean) =>
    update(
      d => ({
        ...d,
        planCourses: on
          ? (d.planCourses.some(pc => pc.planId === planId && pc.courseId === courseId)
            ? d.planCourses : [...d.planCourses, { planId, courseId }])
          : d.planCourses.filter(pc => !(pc.planId === planId && pc.courseId === courseId)),
      }),
      () => on
        ? supabase!.from("plan_courses").upsert({ plan_id: planId, course_id: courseId })
        : supabase!.from("plan_courses").delete().eq("plan_id", planId).eq("course_id", courseId),
    );

  const addCourse = (title: string, description: string) => {
    const sortOrder = Math.max(0, ...db.courses.map(c => c.sortOrder)) + 1;
    if (isLive) {
      supabase!.from("courses").insert({ title, description, sort_order: sortOrder, is_published: false }).select().single()
        .then(({ data }) => { if (data) setDb(d => ({ ...d, courses: [...d.courses, rowToCourse(data)] })); }, logErr("addCourse"));
      return;
    }
    update(d => ({ ...d, courses: [...d.courses, { id: uid("c"), title, description, isPublished: false, sortOrder }] }));
  };
  const updateCourse = (id: string, patch: Partial<Course>) =>
    update(
      d => ({ ...d, courses: d.courses.map(c => c.id === id ? { ...c, ...patch } : c) }),
      () => {
        const row: Row = {};
        if (patch.title !== undefined) row.title = patch.title;
        if (patch.description !== undefined) row.description = patch.description;
        if (patch.isPublished !== undefined) row.is_published = patch.isPublished;
        return supabase!.from("courses").update(row).eq("id", id);
      },
    );
  const deleteCourse = (id: string): boolean => {
    if (db.sections.some(s => s.courseId === id)) return false;
    update(
      d => ({ ...d, courses: d.courses.filter(c => c.id !== id), planCourses: d.planCourses.filter(pc => pc.courseId !== id) }),
      () => supabase!.from("courses").delete().eq("id", id),
    );
    return true;
  };
  const moveCourse = (id: string, dir: -1 | 1) => {
    const arr = [...db.courses].sort((a, b) => a.sortOrder - b.sortOrder);
    const i = arr.findIndex(x => x.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    const a = arr[i], b = arr[j];
    update(
      d => ({ ...d, courses: d.courses.map(x => x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x) }),
      swapOrder("courses", a.id, a.sortOrder, b.id, b.sortOrder),
    );
  };

  const store: Store = {
    db, user, ready, isLive, theme, setTheme, login, logout, requestPasswordReset, updatePassword,
    visibleCourses, sectionsOf, lessonsOf, visibleLessons, progressOf, stateOf,
    overallRate, courseRate, recordView, recordWatched, submitQuiz, isFav, toggleFav, myQuizResults,
    addSection, updateSection, deleteSection, moveSection,
    addLesson, updateLesson, deleteLesson, moveLesson,
    addQuestion, updateQuestion, deleteQuestion,
    addMember, updateMember, deleteMember, resetMemberPassword,
    addPlan, updatePlan, deletePlan, setPlanCourse,
    addCourse, updateCourse, deleteCourse, moveCourse,
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}

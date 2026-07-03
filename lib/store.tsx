"use client";
// アプリ全体の状態管理（プロトタイプ＝デモモード）
// - データはブラウザのlocalStorageに保存（Supabase接続時はこのファイルの実装を差し替える）
// - 認証・権限チェック（有効期限・停止・プラン別コース制御）もここで担保する
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  Member, Plan, PlanCourse, Course, Section, Lesson, Question, Progress, QuizResult, Favorite,
  Theme, PASS_LINE,
} from "./types";
import {
  demoMembers, demoPlans, demoPlanCourses, demoCourses, demoSections, demoLessons,
  demoQuestions, demoProgress, demoQuizResults, demoFavorites,
} from "./demo-data";

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

const initialDB: DB = {
  members: demoMembers, plans: demoPlans, planCourses: demoPlanCourses, courses: demoCourses,
  sections: demoSections, lessons: demoLessons, questions: demoQuestions,
  progress: demoProgress, quizResults: demoQuizResults, favorites: demoFavorites,
};

export type LoginResult = { ok: true } | { ok: false; message: string };

interface Store {
  db: DB;
  user: Member | null;
  ready: boolean;
  theme: Theme;
  setTheme: (t: Theme) => void;
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  // 会員側
  visibleCourses: () => Course[];
  sectionsOf: (courseId: string) => Section[];
  lessonsOf: (sectionId: string) => Lesson[];
  visibleLessons: () => Lesson[]; // プラン内・公開中の全レッスン
  progressOf: (lessonId: string) => Progress | undefined;
  stateOf: (lessonId: string) => "none" | "watch" | "done";
  overallRate: () => { done: number; total: number; pct: number };
  courseRate: (courseId: string) => { done: number; total: number; pct: number };
  recordView: (lessonId: string) => void;
  recordWatched: (lessonId: string) => void;
  submitQuiz: (lessonId: string, score: number) => boolean; // 戻り値=合格
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
  addMember: (m: Omit<Member, "id" | "role" | "lastLoginAt" | "createdAt">) => LoginResult;
  updateMember: (id: string, patch: Partial<Member>) => void;
  deleteMember: (id: string) => void;
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

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(initialDB);
  const [user, setUser] = useState<Member | null>(null);
  const [theme, setThemeState] = useState<Theme>("standard");
  const [ready, setReady] = useState(false);

  // localStorage から復元
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.db) setDb(saved.db);
        if (saved.userId) {
          const u = (saved.db as DB).members.find((m: Member) => m.id === saved.userId) || null;
          if (u) { setUser(u); setThemeState(u.theme); }
        }
      }
    } catch { /* 破損時は初期データで開始 */ }
    setReady(true);
  }, []);

  // 保存
  const persist = useCallback((nextDb: DB, nextUser: Member | null) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ db: nextDb, userId: nextUser?.id ?? null }));
    } catch { /* 容量超過などは無視 */ }
  }, []);

  const update = useCallback((fn: (d: DB) => DB) => {
    setDb(prev => {
      const next = fn(prev);
      persist(next, user);
      return next;
    });
  }, [persist, user]);

  /* ---------- 認証 ---------- */
  const login = (email: string, _password: string): LoginResult => {
    const m = db.members.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!m) return { ok: false, message: "メールアドレスまたはパスワードが正しくありません。" };
    if (m.status === "suspended") return { ok: false, message: "このアカウントは停止中です。運営までご連絡ください。" };
    if (m.role !== "admin" && m.expiresAt < todayStr()) {
      return { ok: false, message: `ご利用期限（${m.expiresAt.replace(/-/g, "/")}）を過ぎているため、ログインできません。継続をご希望の場合は運営（info@life-m-c.com）までご連絡ください。` };
    }
    const logged = { ...m, lastLoginAt: new Date().toISOString() };
    const nextDb = { ...db, members: db.members.map(x => x.id === m.id ? logged : x) };
    setDb(nextDb);
    setUser(logged);
    setThemeState(logged.theme);
    persist(nextDb, logged);
    return { ok: true };
  };

  const logout = () => { setUser(null); persist(db, null); };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (user) {
      const u = { ...user, theme: t };
      setUser(u);
      update(d => ({ ...d, members: d.members.map(m => m.id === u.id ? u : m) }));
    }
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
    return db.lessons
      .filter(l => l.isPublished && secIds.has(l.sectionId))
      .sort((a, b) => a.sortOrder - b.sortOrder);
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
    const total = lessons.length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  };
  const overallRate = () => rateOf(visibleLessons());
  const courseRate = (courseId: string) => {
    const secIds = new Set(sectionsOf(courseId).map(s => s.id));
    return rateOf(visibleLessons().filter(l => secIds.has(l.sectionId)));
  };

  const upsertProgress = (lessonId: string, patch: (p: Progress) => Progress) => {
    if (!user) return;
    update(d => {
      const exists = d.progress.find(p => p.userId === user.id && p.lessonId === lessonId);
      const base: Progress = exists ?? { userId: user.id, lessonId, viewCount: 0, watchedAt: null, completedAt: null };
      const next = patch(base);
      return {
        ...d,
        progress: exists
          ? d.progress.map(p => (p.userId === user.id && p.lessonId === lessonId ? next : p))
          : [...d.progress, next],
      };
    });
  };

  const recordView = (lessonId: string) =>
    upsertProgress(lessonId, p => ({ ...p, viewCount: p.viewCount + 1 }));

  const recordWatched = (lessonId: string) =>
    upsertProgress(lessonId, p => {
      const watched = { ...p, watchedAt: p.watchedAt ?? new Date().toISOString() };
      // テスト問題が無いレッスンは視聴完了＝レッスン完了
      const hasQuiz = db.questions.some(q => q.lessonId === lessonId);
      return hasQuiz ? watched : { ...watched, completedAt: watched.completedAt ?? new Date().toISOString() };
    });

  const submitQuiz = (lessonId: string, score: number): boolean => {
    if (!user) return false;
    const passed = score >= PASS_LINE;
    update(d => ({
      ...d,
      quizResults: [...d.quizResults, {
        id: uid("r"), userId: user.id, lessonId, score, passed, takenAt: new Date().toISOString(),
      }],
    }));
    if (passed) upsertProgress(lessonId, p => ({ ...p, completedAt: p.completedAt ?? new Date().toISOString() }));
    return passed;
  };

  const isFav = (lessonId: string) =>
    !!user && db.favorites.some(f => f.userId === user.id && f.lessonId === lessonId);
  const toggleFav = (lessonId: string) => {
    if (!user) return;
    update(d => ({
      ...d,
      favorites: isFav(lessonId)
        ? d.favorites.filter(f => !(f.userId === user.id && f.lessonId === lessonId))
        : [...d.favorites, { userId: user.id, lessonId }],
    }));
  };
  const myQuizResults = () =>
    user ? db.quizResults.filter(r => r.userId === user.id).sort((a, b) => b.takenAt.localeCompare(a.takenAt)) : [];

  /* ---------- 管理側 ---------- */
  const addSection = (courseId: string, title: string) =>
    update(d => ({
      ...d,
      sections: [...d.sections, {
        id: uid("s"), courseId, title,
        sortOrder: Math.max(0, ...d.sections.filter(s => s.courseId === courseId).map(s => s.sortOrder)) + 1,
      }],
    }));
  const updateSection = (id: string, patch: Partial<Section>) =>
    update(d => ({ ...d, sections: d.sections.map(s => s.id === id ? { ...s, ...patch } : s) }));
  const deleteSection = (id: string): boolean => {
    if (db.lessons.some(l => l.sectionId === id)) return false;
    update(d => ({ ...d, sections: d.sections.filter(s => s.id !== id) }));
    return true;
  };
  const moveSection = (id: string, dir: -1 | 1) =>
    update(d => {
      const s = d.sections.find(x => x.id === id); if (!s) return d;
      const arr = d.sections.filter(x => x.courseId === s.courseId).sort((a, b) => a.sortOrder - b.sortOrder);
      const i = arr.findIndex(x => x.id === id); const j = i + dir;
      if (j < 0 || j >= arr.length) return d;
      const a = arr[i], b = arr[j];
      return { ...d, sections: d.sections.map(x => x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x) };
    });

  const addLesson = (sectionId: string, data: { title: string; description: string; videoId: string; pdfUrl: string }) =>
    update(d => ({
      ...d,
      lessons: [...d.lessons, {
        id: uid("l"), sectionId, ...data, isPublished: false,
        sortOrder: Math.max(0, ...d.lessons.filter(l => l.sectionId === sectionId).map(l => l.sortOrder)) + 1,
      }],
    }));
  const updateLesson = (id: string, patch: Partial<Lesson>) =>
    update(d => ({ ...d, lessons: d.lessons.map(l => l.id === id ? { ...l, ...patch } : l) }));
  const deleteLesson = (id: string) =>
    update(d => ({
      ...d,
      lessons: d.lessons.filter(l => l.id !== id),
      questions: d.questions.filter(q => q.lessonId !== id),
      progress: d.progress.filter(p => p.lessonId !== id),
      quizResults: d.quizResults.filter(r => r.lessonId !== id),
      favorites: d.favorites.filter(f => f.lessonId !== id),
    }));
  const moveLesson = (id: string, dir: -1 | 1) =>
    update(d => {
      const l = d.lessons.find(x => x.id === id); if (!l) return d;
      const arr = d.lessons.filter(x => x.sectionId === l.sectionId).sort((a, b) => a.sortOrder - b.sortOrder);
      const i = arr.findIndex(x => x.id === id); const j = i + dir;
      if (j < 0 || j >= arr.length) return d;
      const a = arr[i], b = arr[j];
      return { ...d, lessons: d.lessons.map(x => x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x) };
    });

  const addQuestion = (q: Omit<Question, "id">) =>
    update(d => ({ ...d, questions: [...d.questions, { ...q, id: uid("q") }] }));
  const updateQuestion = (id: string, patch: Partial<Question>) =>
    update(d => ({ ...d, questions: d.questions.map(q => q.id === id ? { ...q, ...patch } : q) }));
  const deleteQuestion = (id: string) =>
    update(d => ({ ...d, questions: d.questions.filter(q => q.id !== id) }));

  const addMember = (m: Omit<Member, "id" | "role" | "lastLoginAt" | "createdAt">): LoginResult => {
    if (db.members.some(x => x.email.toLowerCase() === m.email.toLowerCase()))
      return { ok: false, message: "このメールアドレスは既に登録されています。" };
    update(d => ({
      ...d,
      members: [...d.members, { ...m, id: uid("u"), role: "member", lastLoginAt: "", createdAt: todayStr() }],
    }));
    return { ok: true };
  };
  const updateMember = (id: string, patch: Partial<Member>) =>
    update(d => ({ ...d, members: d.members.map(m => m.id === id ? { ...m, ...patch } : m) }));
  const deleteMember = (id: string) =>
    update(d => ({
      ...d,
      members: d.members.filter(m => m.id !== id),
      progress: d.progress.filter(p => p.userId !== id),
      quizResults: d.quizResults.filter(r => r.userId !== id),
      favorites: d.favorites.filter(f => f.userId !== id),
    }));

  const addPlan = (name: string, description: string) =>
    update(d => ({
      ...d,
      plans: [...d.plans, { id: uid("p"), name, description, sortOrder: Math.max(0, ...d.plans.map(p => p.sortOrder)) + 1 }],
    }));
  const updatePlan = (id: string, patch: Partial<Plan>) =>
    update(d => ({ ...d, plans: d.plans.map(p => p.id === id ? { ...p, ...patch } : p) }));
  const deletePlan = (id: string): boolean => {
    if (db.members.some(m => m.planId === id)) return false;
    update(d => ({
      ...d,
      plans: d.plans.filter(p => p.id !== id),
      planCourses: d.planCourses.filter(pc => pc.planId !== id),
    }));
    return true;
  };
  const setPlanCourse = (planId: string, courseId: string, on: boolean) =>
    update(d => ({
      ...d,
      planCourses: on
        ? (d.planCourses.some(pc => pc.planId === planId && pc.courseId === courseId)
          ? d.planCourses
          : [...d.planCourses, { planId, courseId }])
        : d.planCourses.filter(pc => !(pc.planId === planId && pc.courseId === courseId)),
    }));

  const addCourse = (title: string, description: string) =>
    update(d => ({
      ...d,
      courses: [...d.courses, {
        id: uid("c"), title, description, isPublished: false,
        sortOrder: Math.max(0, ...d.courses.map(c => c.sortOrder)) + 1,
      }],
    }));
  const updateCourse = (id: string, patch: Partial<Course>) =>
    update(d => ({ ...d, courses: d.courses.map(c => c.id === id ? { ...c, ...patch } : c) }));
  const deleteCourse = (id: string): boolean => {
    if (db.sections.some(s => s.courseId === id)) return false;
    update(d => ({
      ...d,
      courses: d.courses.filter(c => c.id !== id),
      planCourses: d.planCourses.filter(pc => pc.courseId !== id),
    }));
    return true;
  };
  const moveCourse = (id: string, dir: -1 | 1) =>
    update(d => {
      const arr = [...d.courses].sort((a, b) => a.sortOrder - b.sortOrder);
      const i = arr.findIndex(x => x.id === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return d;
      const a = arr[i], b = arr[j];
      return { ...d, courses: d.courses.map(x => x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x) };
    });

  const store: Store = {
    db, user, ready, theme, setTheme, login, logout,
    visibleCourses, sectionsOf, lessonsOf, visibleLessons, progressOf, stateOf,
    overallRate, courseRate, recordView, recordWatched, submitQuiz, isFav, toggleFav, myQuizResults,
    addSection, updateSection, deleteSection, moveSection,
    addLesson, updateLesson, deleteLesson, moveLesson,
    addQuestion, updateQuestion, deleteQuestion,
    addMember, updateMember, deleteMember,
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

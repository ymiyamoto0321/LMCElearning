// LMC e-learning 型定義（詳細設計書 v1.0 のテーブル構成に対応）

export type Role = "admin" | "member";
export type Theme = "standard" | "rose";
export type MemberStatus = "active" | "suspended";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  planId: string | null; // 契約プラン（adminはnull=全コース）
  expiresAt: string;     // 有効期限日 YYYY-MM-DD
  theme: Theme;
  lastLoginAt: string;   // ISO文字列（未ログインは""）
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface PlanCourse {
  planId: string;
  courseId: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface Section {
  id: string;
  courseId: string;
  title: string;
  sortOrder: number;
}

export interface Lesson {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  videoId: string; // YouTube動画ID
  pdfUrl: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface Question {
  id: string;
  lessonId: string;
  questionText: string;
  choices: string[]; // 4択
  correctIndex: number; // 0-3
  explanation: string;
}

export interface Progress {
  userId: string;
  lessonId: string;
  viewCount: number;
  watchedAt: string | null;   // 視聴完了
  completedAt: string | null; // レッスン完了（テスト合格）
}

export interface QuizResult {
  id: string;
  userId: string;
  lessonId: string;
  score: number;   // 0-5
  passed: boolean; // 4問以上正解
  takenAt: string;
}

export interface Favorite {
  userId: string;
  lessonId: string;
}

export const PASS_LINE = 4;   // 5問中4問正解で合格
export const QUIZ_SIZE = 5;   // 出題数

/** YouTube URL から動画IDを抽出（ID直接入力にも対応） */
export function extractVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m =
    s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/[?&]v=([\w-]{11})/) ||
    s.match(/youtube\.com\/embed\/([\w-]{11})/) ||
    s.match(/youtube\.com\/live\/([\w-]{11})/);
  return m ? m[1] : null;
}

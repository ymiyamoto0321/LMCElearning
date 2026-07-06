// LMC e-learning 型定義（詳細設計書 v1.0 のテーブル構成に対応）

export type Role = "admin" | "member";
export type Theme = "standard" | "rose" | "beauty";
export type MemberStatus = "active" | "suspended";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus; // 会員単位の強制停止
  theme: Theme;
  lastLoginAt: string;   // ISO文字列（未ログインは""）
  createdAt: string;
}

/** 契約（会員×プラン）。有効期限・強制無効化は契約単位で管理する */
export interface Contract {
  userId: string;
  planId: string;
  expiresAt: string; // 有効期限日 YYYY-MM-DD
  status: "active" | "disabled"; // disabled=強制無効化
  createdAt: string;
}

/** 契約が現在有効か（期限内かつ無効化されていない） */
export function isContractValid(c: Contract, today?: string): boolean {
  const t = today ?? new Date().toISOString().slice(0, 10);
  return c.status === "active" && c.expiresAt >= t;
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

/** 動画URLからIDを抽出。YouTube（ID）または Google Drive（gdrive:ID 形式で保存） */
export function extractVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s) || /^gdrive:[\w-]+$/.test(s)) return s;
  const m =
    s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/[?&]v=([\w-]{11})/) ||
    s.match(/youtube\.com\/embed\/([\w-]{11})/) ||
    s.match(/youtube\.com\/live\/([\w-]{11})/);
  if (m) return m[1];
  const d = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (d) return `gdrive:${d[1]}`;
  return null;
}

/** Google Drive動画か */
export function isDriveVideo(videoId: string): boolean {
  return videoId.startsWith("gdrive:");
}
/** Google Drive埋め込みプレーヤーURL */
export function driveEmbedUrl(videoId: string): string {
  return `https://drive.google.com/file/d/${videoId.replace(/^gdrive:/, "")}/preview`;
}

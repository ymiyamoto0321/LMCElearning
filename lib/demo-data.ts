// デモデータ（プロトタイプ用。Supabase接続後はDBのシードデータに置き換え）
import { Member, Plan, PlanCourse, Course, Section, Lesson, Question, Progress, QuizResult, Favorite } from "./types";

export const demoPlans: Plan[] = [
  { id: "p-basic", name: "ベーシック", description: "経営コースのみ", sortOrder: 1 },
  { id: "p-premium", name: "プレミアム", description: "経営＋営業の全コース", sortOrder: 2 },
];

export const demoCourses: Course[] = [
  { id: "c-keiei", title: "経営コース", description: "経営の土台と数字に強くなる", sortOrder: 1, isPublished: true },
  { id: "c-eigyo", title: "営業コース", description: "売れる営業の型を身につける", sortOrder: 2, isPublished: true },
];

export const demoPlanCourses: PlanCourse[] = [
  { planId: "p-basic", courseId: "c-keiei" },
  { planId: "p-premium", courseId: "c-keiei" },
  { planId: "p-premium", courseId: "c-eigyo" },
];

export const demoMembers: Member[] = [
  { id: "u-admin", name: "宮本 悠樹", email: "info@life-m-c.com", role: "admin", status: "active", planId: null, expiresAt: "2099-12-31", theme: "standard", lastLoginAt: "2026-07-04T09:00:00", createdAt: "2026-07-01" },
  { id: "u-hanako", name: "デモ会員 花子", email: "member@demo.jp", role: "member", status: "active", planId: "p-premium", expiresAt: "2027-09-14", theme: "rose", lastLoginAt: "2026-07-02T21:14:00", createdAt: "2026-09-15" },
  { id: "u-sato", name: "佐藤 美咲", email: "sato@demo.jp", role: "member", status: "active", planId: "p-basic", expiresAt: "2026-07-25", theme: "rose", lastLoginAt: "2026-06-28T09:40:00", createdAt: "2026-09-20" },
  { id: "u-tanaka", name: "田中 由紀", email: "tanaka@demo.jp", role: "member", status: "active", planId: "p-basic", expiresAt: "2026-06-01", theme: "standard", lastLoginAt: "2026-05-12T18:03:00", createdAt: "2025-06-01" },
  { id: "u-suzuki", name: "鈴木 恵", email: "suzuki@demo.jp", role: "member", status: "suspended", planId: "p-premium", expiresAt: "2027-09-30", theme: "rose", lastLoginAt: "2026-04-02T11:20:00", createdAt: "2026-10-01" },
];

export const demoSections: Section[] = [
  { id: "s1", courseId: "c-keiei", title: "0章 講座を始める前に", sortOrder: 1 },
  { id: "s2", courseId: "c-keiei", title: "1章 経営の土台をつくる", sortOrder: 2 },
  { id: "s3", courseId: "c-eigyo", title: "1章 売れる営業の型", sortOrder: 1 },
];

export const demoLessons: Lesson[] = [
  { id: "l1", sectionId: "s1", title: "この講座で学べること", description: "講座全体のゴールと進め方を説明します。", videoId: "dQw4w9WgXcQ", pdfUrl: "", sortOrder: 1, isPublished: true },
  { id: "l2", sectionId: "s1", title: "学習の進め方と達成率の見方", description: "視聴→確認テストの流れを説明します。", videoId: "dQw4w9WgXcQ", pdfUrl: "", sortOrder: 2, isPublished: true },
  { id: "l3", sectionId: "s2", title: "経営理念とミッションの作り方", description: "", videoId: "dQw4w9WgXcQ", pdfUrl: "", sortOrder: 1, isPublished: true },
  { id: "l4", sectionId: "s2", title: "損益分岐点と固定費の考え方", description: "", videoId: "dQw4w9WgXcQ", pdfUrl: "", sortOrder: 2, isPublished: true },
  { id: "l5", sectionId: "s3", title: "ヒアリングの6ステップ", description: "", videoId: "dQw4w9WgXcQ", pdfUrl: "", sortOrder: 1, isPublished: true },
  { id: "l6", sectionId: "s3", title: "テストクロージングの実践", description: "", videoId: "dQw4w9WgXcQ", pdfUrl: "", sortOrder: 2, isPublished: false },
];

export const demoQuestions: Question[] = [
  { id: "q1", lessonId: "l1", questionText: "この講座の最終ゴールとして正しいものはどれ？", choices: ["知識を暗記すること", "学んだ内容を自分の事業で実践すること", "動画をすべて視聴すること", "テストで満点を取ること"], correctIndex: 1, explanation: "学び→実践→成果につなげることが講座のゴールです。" },
  { id: "q2", lessonId: "l1", questionText: "レッスンが「完了」になる条件は？", choices: ["動画を開くこと", "視聴完了＋確認テスト合格", "テストを1回受けること", "資料をダウンロードすること"], correctIndex: 1, explanation: "最後まで視聴し、テストに合格すると完了になります。" },
  { id: "q3", lessonId: "l1", questionText: "確認テストの合格ラインは？", choices: ["3問正解", "4問正解", "5問正解", "合格基準はない"], correctIndex: 1, explanation: "5問中4問（80%）の正解で合格です。" },
  { id: "q4", lessonId: "l1", questionText: "テストに不合格だった場合は？", choices: ["再挑戦できない", "翌日まで待つ", "何度でも再挑戦できる", "管理者に申請する"], correctIndex: 2, explanation: "回数無制限で再挑戦できます。" },
  { id: "q5", lessonId: "l1", questionText: "達成率はどこで確認できる？", choices: ["ダッシュボード", "ログイン画面", "メール", "確認できない"], correctIndex: 0, explanation: "ダッシュボードに全体達成率が表示されます。" },
  { id: "q6", lessonId: "l1", questionText: "動画はどの端末で視聴できる？", choices: ["PCのみ", "スマホのみ", "PC・タブレット・スマホ", "タブレットのみ"], correctIndex: 2, explanation: "レスポンシブ対応でどの端末でも学べます。" },
  { id: "q7", lessonId: "l2", questionText: "視聴完了と記録されるのはいつ？", choices: ["動画を開いた時", "半分まで見た時", "最後まで再生した時", "テスト合格時"], correctIndex: 2, explanation: "動画を最後まで再生すると自動で記録されます。" },
  { id: "q8", lessonId: "l2", questionText: "達成率の計算方法は？", choices: ["視聴時間の合計", "完了レッスン数÷公開レッスン数", "テストの平均点", "ログイン回数"], correctIndex: 1, explanation: "" },
  { id: "q9", lessonId: "l2", questionText: "「続きから学ぶ」ボタンの動きは？", choices: ["最初のレッスンへ", "未完了の先頭レッスンへ", "最後のレッスンへ", "ランダムなレッスンへ"], correctIndex: 1, explanation: "" },
  { id: "q10", lessonId: "l2", questionText: "視聴完了前にテストは受けられる？", choices: ["受けられる", "受けられない", "管理者なら受けられる", "1回だけ受けられる"], correctIndex: 1, explanation: "" },
  { id: "q11", lessonId: "l2", questionText: "資料PDFがあるレッスンでは？", choices: ["必ず印刷が必要", "ダウンロードして参照できる", "視聴できない", "テストが免除される"], correctIndex: 1, explanation: "" },
];

export const demoProgress: Progress[] = [
  { userId: "u-hanako", lessonId: "l1", viewCount: 3, watchedAt: "2026-07-01T10:00:00", completedAt: "2026-07-02T21:20:00" },
  { userId: "u-hanako", lessonId: "l2", viewCount: 1, watchedAt: "2026-07-02T22:00:00", completedAt: null },
  { userId: "u-sato", lessonId: "l1", viewCount: 2, watchedAt: "2026-06-20T10:00:00", completedAt: "2026-06-20T10:30:00" },
];

export const demoQuizResults: QuizResult[] = [
  { id: "r1", userId: "u-hanako", lessonId: "l1", score: 3, passed: false, takenAt: "2026-07-01T21:00:00" },
  { id: "r2", userId: "u-hanako", lessonId: "l1", score: 5, passed: true, takenAt: "2026-07-02T21:20:00" },
  { id: "r3", userId: "u-sato", lessonId: "l1", score: 4, passed: true, takenAt: "2026-06-20T10:30:00" },
];

export const demoFavorites: Favorite[] = [
  { userId: "u-hanako", lessonId: "l3" },
  { userId: "u-hanako", lessonId: "l5" },
];

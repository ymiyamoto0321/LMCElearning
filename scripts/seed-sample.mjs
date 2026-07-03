// サンプルデータ投入スクリプト（動作確認用・全パターン網羅）
// 使い方: node scripts/seed-sample.mjs
// .env.local の URL / SUPABASE_SERVICE_ROLE_KEY を使用。既存の同名データがあればスキップする。
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

let env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch { /* noop */ }
const URL = env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) { console.error("❌ .env.local が未設定です"); process.exit(1); }
const svc = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const SAMPLE_PASSWORD = "LmcDemo-2026"; // サンプル会員の共通パスワード
const log = (s) => console.log(s);

/* ---------- 1. プラン（3パターン: 単一コース/全コース/コース未割当） ---------- */
async function upsertPlan(name, description, sortOrder) {
  const { data: exist } = await svc.from("plans").select("id").eq("name", name).maybeSingle();
  if (exist) { log(`⏭  プラン「${name}」は既存`); return exist.id; }
  const { data, error } = await svc.from("plans").insert({ name, description, sort_order: sortOrder }).select().single();
  if (error) throw new Error(`プラン${name}: ${error.message}`);
  log(`✅ プラン「${name}」作成`);
  return data.id;
}

/* ---------- 2. コース ---------- */
async function upsertCourse(title, description, sortOrder, isPublished) {
  const { data: exist } = await svc.from("courses").select("id").eq("title", title).maybeSingle();
  if (exist) { log(`⏭  コース「${title}」は既存`); return exist.id; }
  const { data, error } = await svc.from("courses").insert({ title, description, sort_order: sortOrder, is_published: isPublished }).select().single();
  if (error) throw new Error(`コース${title}: ${error.message}`);
  log(`✅ コース「${title}」作成（${isPublished ? "公開" : "下書き"}）`);
  return data.id;
}

async function linkPlanCourse(planId, courseId) {
  await svc.from("plan_courses").upsert({ plan_id: planId, course_id: courseId });
}

/* ---------- 3. 章・レッスン・問題 ---------- */
async function upsertSection(courseId, title, sortOrder) {
  const { data: exist } = await svc.from("sections").select("id").eq("course_id", courseId).eq("title", title).maybeSingle();
  if (exist) return exist.id;
  const { data, error } = await svc.from("sections").insert({ course_id: courseId, title, sort_order: sortOrder }).select().single();
  if (error) throw new Error(`章${title}: ${error.message}`);
  log(`✅ 章「${title}」作成`);
  return data.id;
}

async function upsertLesson(sectionId, l) {
  const { data: exist } = await svc.from("lessons").select("id").eq("section_id", sectionId).eq("title", l.title).maybeSingle();
  if (exist) return exist.id;
  const { data, error } = await svc.from("lessons").insert({
    section_id: sectionId, title: l.title, description: l.description ?? "",
    video_id: l.videoId, pdf_url: l.pdfUrl ?? null, sort_order: l.sortOrder, is_published: l.isPublished,
  }).select().single();
  if (error) throw new Error(`レッスン${l.title}: ${error.message}`);
  log(`✅ レッスン「${l.title}」作成（${l.isPublished ? "公開" : "下書き"}）`);
  return data.id;
}

async function addQuestions(lessonId, lessonTitle, qs) {
  const { count } = await svc.from("questions").select("*", { count: "exact", head: true }).eq("lesson_id", lessonId);
  if ((count ?? 0) > 0) { log(`⏭  「${lessonTitle}」の問題は既存（${count}問）`); return; }
  const rows = qs.map(q => ({ lesson_id: lessonId, question_text: q.t, choices: q.c, correct_index: q.a, explanation: q.e ?? null }));
  const { error } = await svc.from("questions").insert(rows);
  if (error) throw new Error(`問題(${lessonTitle}): ${error.message}`);
  log(`✅ 「${lessonTitle}」に${qs.length}問登録`);
}

/* ---------- 4. 会員 ---------- */
async function upsertMember(m) {
  const { data: exist } = await svc.from("profiles").select("id").eq("email", m.email).maybeSingle();
  if (exist) { log(`⏭  会員 ${m.name} は既存`); return exist.id; }
  const { data: created, error } = await svc.auth.admin.createUser({ email: m.email, password: SAMPLE_PASSWORD, email_confirm: true });
  if (error) throw new Error(`Auth ${m.email}: ${error.message}`);
  const { error: pErr } = await svc.from("profiles").insert({
    id: created.user.id, name: m.name, email: m.email, role: "member",
    status: m.status, plan_id: m.planId, expires_at: m.expiresAt, theme: m.theme,
    last_login_at: m.lastLoginAt ?? null,
  });
  if (pErr) { await svc.auth.admin.deleteUser(created.user.id); throw new Error(`profiles ${m.email}: ${pErr.message}`); }
  log(`✅ 会員「${m.name}」作成（${m.note}）`);
  return created.user.id;
}

/* ---------- メイン ---------- */
try {
  // プラン
  const basic = await upsertPlan("ベーシック", "経営コースのみ", 1);
  const premium = await upsertPlan("プレミアム", "経営＋営業の全コース", 2);
  const trial = await upsertPlan("お試し（コース未割当）", "コースを割り当てていないプランの表示確認用", 3);

  // コース（公開2＋下書き1）
  const keiei = await upsertCourse("経営コース", "経営の土台と数字に強くなる", 1, true);
  const eigyo = await upsertCourse("営業コース", "売れる営業の型を身につける", 2, true);
  const draft = await upsertCourse("準備中コース（下書き）", "非公開コースの表示確認用", 3, false);

  await linkPlanCourse(basic, keiei);
  await linkPlanCourse(premium, keiei);
  await linkPlanCourse(premium, eigyo);
  await linkPlanCourse(premium, draft); // 下書きコースは割当てても会員に見えないことの確認用

  // 章
  const s0 = await upsertSection(keiei, "0章 講座を始める前に", 1);
  const s1 = await upsertSection(keiei, "1章 経営の土台をつくる", 2);
  const s2 = await upsertSection(eigyo, "1章 売れる営業の型", 1);
  const s3 = await upsertSection(eigyo, "2章 クロージング実践", 2);
  const sd = await upsertSection(draft, "1章 準備中", 1);

  // レッスン（各パターン）
  // ※動画は一般公開の短い動画で代用（実運用ではYouTube限定公開URLに差し替え）
  const V_SHORT = "jNQXAC9IVRw"; // 19秒（「最後まで再生→視聴完了」の確認が楽）
  const V_MID = "dQw4w9WgXcQ";

  const l1 = await upsertLesson(s0, { title: "この講座で学べること", description: "講座全体のゴールと進め方。", videoId: V_SHORT, sortOrder: 1, isPublished: true });
  const l2 = await upsertLesson(s0, { title: "学習の進め方と達成率の見方", description: "視聴→確認テストの流れ。", videoId: V_SHORT, sortOrder: 2, isPublished: true,
    pdfUrl: "https://www.soumu.go.jp/main_content/000949243.pdf" }); // 資料PDF付きパターン（差し替え可）
  const l3 = await upsertLesson(s1, { title: "経営理念とミッションの作り方", videoId: V_MID, sortOrder: 1, isPublished: true }); // テスト問題なし→視聴のみで完了
  const l4 = await upsertLesson(s1, { title: "損益分岐点と固定費の考え方", videoId: V_MID, sortOrder: 2, isPublished: true }); // 問題3問→「要追加」バッジ確認
  const l5 = await upsertLesson(s2, { title: "ヒアリングの6ステップ", videoId: V_SHORT, sortOrder: 1, isPublished: true });
  const l6 = await upsertLesson(s2, { title: "テストクロージングの実践", videoId: V_MID, sortOrder: 2, isPublished: false }); // 下書きレッスン
  const l7 = await upsertLesson(s3, { title: "反論処理の型5選", videoId: V_SHORT, sortOrder: 1, isPublished: true });
  await upsertLesson(sd, { title: "準備中レッスン", videoId: V_MID, sortOrder: 1, isPublished: true }); // 下書きコース配下

  // 問題（8問/5問/3問/0問のパターン）
  await addQuestions(l1, "この講座で学べること", [
    { t: "この講座の最終ゴールは？", c: ["知識の暗記", "自分の事業で実践すること", "動画の全視聴", "テスト満点"], a: 1, e: "学び→実践→成果が講座のゴールです。" },
    { t: "レッスンが「完了」になる条件は？", c: ["動画を開く", "視聴完了＋テスト合格", "テスト1回受験", "資料DL"], a: 1, e: "最後まで視聴し、テストに合格すると完了です。" },
    { t: "確認テストの合格ラインは？", c: ["3問正解", "4問正解", "5問正解", "基準なし"], a: 1, e: "5問中4問（80%）で合格です。" },
    { t: "不合格だった場合は？", c: ["再挑戦不可", "翌日まで待つ", "何度でも再挑戦できる", "管理者に申請"], a: 2, e: "回数無制限で再挑戦できます。" },
    { t: "達成率はどこで確認できる？", c: ["ダッシュボード", "ログイン画面", "メール", "確認できない"], a: 0 },
    { t: "動画はどの端末で視聴できる？", c: ["PCのみ", "スマホのみ", "PC・タブレット・スマホ", "タブレットのみ"], a: 2 },
    { t: "お気に入りに登録するには？", c: ["♥をクリック", "管理者に依頼", "テスト合格が必要", "登録できない"], a: 0 },
    { t: "視聴完了と記録されるのは？", c: ["動画を開いた時", "半分まで見た時", "最後まで再生した時", "テスト合格時"], a: 2 },
  ]);
  await addQuestions(l2, "学習の進め方と達成率の見方", [
    { t: "達成率の計算方法は？", c: ["視聴時間の合計", "完了レッスン数÷公開レッスン数", "テスト平均点", "ログイン回数"], a: 1 },
    { t: "「続きから学ぶ」の動きは？", c: ["最初のレッスンへ", "未完了の先頭レッスンへ", "最後のレッスンへ", "ランダム"], a: 1 },
    { t: "視聴完了前にテストは？", c: ["受けられる", "受けられない", "管理者のみ可", "1回だけ可"], a: 1 },
    { t: "資料PDFがあるレッスンは？", c: ["印刷必須", "ダウンロードして参照できる", "視聴不可", "テスト免除"], a: 1 },
    { t: "テーマの切替はどこから？", c: ["サイドメニュー下部", "ログイン画面", "できない", "管理者のみ"], a: 0 },
  ]);
  await addQuestions(l4, "損益分岐点と固定費の考え方", [ // 3問のみ→「要追加」バッジ
    { t: "損益分岐点とは？", c: ["利益が最大になる点", "売上と費用が等しくなる点", "固定費の合計", "税引後利益"], a: 1 },
    { t: "固定費に含まれるのは？", c: ["仕入原価", "販売手数料", "家賃・人件費", "配送費"], a: 2 },
    { t: "黒字化ラインを下げるには？", c: ["固定費を下げる", "売上を隠す", "在庫を増やす", "値引きする"], a: 0 },
  ]);
  await addQuestions(l5, "ヒアリングの6ステップ", [
    { t: "ヒアリングの最初のステップは？", c: ["クロージング", "現状の確認", "値引き提示", "契約書の説明"], a: 1 },
    { t: "深掘り質問の目的は？", c: ["時間稼ぎ", "本音・課題の把握", "沈黙を避ける", "雑談"], a: 1 },
    { t: "理想を聞く理由は？", c: ["現状とのギャップを明確にする", "褒めるため", "必要ない", "価格を上げるため"], a: 0 },
    { t: "テストクロージングとは？", c: ["最終契約", "購入意向の確認", "テストの採点", "アフターフォロー"], a: 1 },
    { t: "過去の取り組みを聞く目的は？", c: ["失敗を責める", "同じ提案を避ける", "時間を潰す", "聞かなくてよい"], a: 1 },
  ]);
  await addQuestions(l7, "反論処理の型5選", [
    { t: "「高い」と言われたら最初にすることは？", c: ["即値引き", "理由を尋ね共感する", "話題を変える", "諦める"], a: 1 },
    { t: "「検討します」への対応は？", c: ["そのまま待つ", "検討内容を具体化する質問をする", "毎日電話する", "怒る"], a: 1 },
    { t: "反論処理で最も重要なのは？", c: ["論破すること", "相手の不安の正体を掴むこと", "声の大きさ", "資料の枚数"], a: 1 },
    { t: "「他社と比較したい」への対応は？", c: ["比較を止める", "比較軸を一緒に整理する", "他社の悪口", "無視"], a: 1 },
    { t: "沈黙が生まれたら？", c: ["すぐ話し出す", "相手が考える時間として待つ", "雑談する", "退席する"], a: 1 },
  ]);
  // l3は問題0問（視聴のみで完了するパターン）

  // 会員（5パターン）
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const plus = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return fmt(d); };

  const hanako = await upsertMember({ name: "山田 花子", email: "hanako.sample@example.com", status: "active", planId: premium, expiresAt: plus(365), theme: "rose", lastLoginAt: new Date().toISOString(), note: "プレミアム・ローズ・学習進行中" });
  const misaki = await upsertMember({ name: "佐藤 美咲", email: "misaki.sample@example.com", status: "active", planId: basic, expiresAt: plus(20), theme: "rose", lastLoginAt: new Date(Date.now() - 6 * 86400000).toISOString(), note: "ベーシック・まもなく期限（20日後）" });
  const taro = await upsertMember({ name: "田中 太郎", email: "taro.sample@example.com", status: "active", planId: basic, expiresAt: "2026-06-01", theme: "standard", lastLoginAt: "2026-05-12T18:03:00Z", note: "期限切れ→ログイン不可の確認用" });
  await upsertMember({ name: "鈴木 恵", email: "megumi.sample@example.com", status: "suspended", planId: premium, expiresAt: plus(365), theme: "rose", lastLoginAt: "2026-04-02T11:20:00Z", note: "停止中→ログイン不可の確認用" });
  await upsertMember({ name: "高橋 新", email: "arata.sample@example.com", status: "active", planId: trial, expiresAt: plus(365), theme: "standard", lastLoginAt: null, note: "未ログイン・コース未割当プラン" });

  // 学習記録・テスト結果・お気に入り（花子=進行中、美咲=少し、太郎=過去の記録）
  const now = Date.now();
  const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString();
  const seedProgress = async (rows) => { for (const r of rows) await svc.from("progress").upsert(r); };
  await seedProgress([
    { user_id: hanako, lesson_id: l1, view_count: 3, watched_at: iso(3), completed_at: iso(2) },   // 完了
    { user_id: hanako, lesson_id: l2, view_count: 2, watched_at: iso(1), completed_at: null },      // 視聴済・テスト未合格
    { user_id: hanako, lesson_id: l3, view_count: 1, watched_at: iso(1), completed_at: iso(1) },    // 問題なし→視聴のみで完了
    { user_id: hanako, lesson_id: l5, view_count: 1, watched_at: null, completed_at: null },        // 再生したが途中離脱
    { user_id: misaki, lesson_id: l1, view_count: 2, watched_at: iso(10), completed_at: iso(10) },
    { user_id: taro, lesson_id: l1, view_count: 1, watched_at: iso(60), completed_at: null },
  ]);
  const { count: qrCount } = await svc.from("quiz_results").select("*", { count: "exact", head: true });
  if ((qrCount ?? 0) === 0) {
    await svc.from("quiz_results").insert([
      { user_id: hanako, lesson_id: l1, score: 3, passed: false, taken_at: iso(3) },  // 不合格→
      { user_id: hanako, lesson_id: l1, score: 5, passed: true, taken_at: iso(2) },   // 再挑戦で合格
      { user_id: hanako, lesson_id: l2, score: 2, passed: false, taken_at: iso(1) },  // 未合格のまま
      { user_id: misaki, lesson_id: l1, score: 4, passed: true, taken_at: iso(10) },  // ギリギリ合格
      { user_id: taro, lesson_id: l1, score: 1, passed: false, taken_at: iso(60) },
    ]);
    log("✅ テスト結果5件登録（合格/不合格/再挑戦のパターン）");
  } else log(`⏭  テスト結果は既存（${qrCount}件）`);
  await svc.from("favorites").upsert([
    { user_id: hanako, lesson_id: l3 },
    { user_id: hanako, lesson_id: l5 },
    { user_id: misaki, lesson_id: l1 },
  ]);
  log("✅ お気に入り登録");

  console.log("\n🎉 サンプルデータ投入完了");
  console.log(`   サンプル会員の共通パスワード: ${SAMPLE_PASSWORD}`);
} catch (e) {
  console.error("❌ 投入エラー:", e.message);
  process.exit(1);
}

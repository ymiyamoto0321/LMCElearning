"use client";
// 認証ガード付き共通レイアウト（サイドメニュー・テーマ適用・有効期限チェック）
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { LogoMark } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout, theme, setTheme, hasValidAccess } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // テーマ適用（standard / rose / beauty）
  useEffect(() => {
    document.body.classList.toggle("theme-rose", theme === "rose");
    document.body.classList.toggle("theme-beauty", theme === "beauty");
  }, [theme]);

  // 認証・有効期限ガード（全ページ共通）
  useEffect(() => {
    if (!ready) return;
    if (!user) { router.replace("/login"); return; }
    // 全契約が期限切れ/無効化、または停止された場合は強制ログアウト
    if (user.role !== "admin" && (user.status !== "active" || !hasValidAccess(user.id))) {
      logout();
      router.replace("/login");
      return;
    }
    if (pathname.startsWith("/admin") && user.role !== "admin") router.replace("/dashboard");
  }, [ready, user, pathname, router, logout]);

  if (!ready || !user) return null;

  const nav = (href: string, label: string) => (
    <Link href={href} className={pathname.startsWith(href) ? "active" : ""} onClick={() => setMenuOpen(false)}>
      {label}
    </Link>
  );

  return (
    <div className="app">
      <button className="menu-btn" onClick={() => setMenuOpen(o => !o)}>☰</button>
      <aside className={`side ${menuOpen ? "open" : ""}`}>
        <div className="side-brand">
          {/* ビューティテーマ時は丸エンブレム＋Beauty Edition（CSSで出し分け） */}
          <div className="emblem">LMC</div>
          <div className="bname">LMC e-learning</div>
          <div className="ben">Beauty Edition</div>
          <span className="brand-default">
            <LogoMark size={34} />
            <b>LMC <span>e-learning</span></b>
          </span>
        </div>
        <nav>
          <div className="sec-label">{theme === "beauty" ? "Learning" : "学習"}</div>
          {nav("/dashboard", "ダッシュボード")}
          {nav("/lessons", "コース目次")}
          {user.role === "admin" && (
            <>
              <div className="sec-label">{theme === "beauty" ? "Admin" : "管理"}</div>
              {nav("/admin/lessons", "レッスン管理")}
              {nav("/admin/questions", "問題管理")}
              {nav("/admin/plans", "プラン・コース管理")}
              {nav("/admin/members", "会員管理")}
              {nav("/admin/progress", "進捗管理")}
            </>
          )}
        </nav>
        <div className="side-user">
          <b>{user.name}{theme === "beauty" ? " さま" : ""}</b>
          {user.role === "admin" ? "管理者" : "会員"}
          <br />
          <button onClick={() => setTheme(theme === "standard" ? "rose" : theme === "rose" ? "beauty" : "standard")}>
            🎨 {theme === "standard" ? "スタンダード" : theme === "rose" ? "ローズ" : "ビューティ"}（切替）
          </button>
          <button onClick={() => { logout(); router.push("/login"); }}>ログアウト</button>
        </div>
      </aside>
      <main className="main">
        {children}
        <div className="beauty-footer">
          <div className="lmc">L M C</div>
          <div className="co">LIFE MANAGEMENT COMPANY</div>
        </div>
      </main>
    </div>
  );
}

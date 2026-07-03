"use client";
// 認証ガード付き共通レイアウト（サイドメニュー・テーマ適用・有効期限チェック）
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { LogoMark } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout, theme, setTheme } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // テーマ適用
  useEffect(() => {
    document.body.classList.toggle("theme-rose", theme === "rose");
  }, [theme]);

  // 認証・有効期限ガード（全ページ共通）
  useEffect(() => {
    if (!ready) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role !== "admin" && user.expiresAt < new Date().toISOString().slice(0, 10)) {
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
          <LogoMark size={34} />
          <b>LMC <span>e-learning</span></b>
        </div>
        <nav>
          <div className="sec-label">学習</div>
          {nav("/dashboard", "ダッシュボード")}
          {nav("/lessons", "コース目次")}
          {user.role === "admin" && (
            <>
              <div className="sec-label">管理</div>
              {nav("/admin/lessons", "レッスン管理")}
              {nav("/admin/questions", "問題管理")}
              {nav("/admin/plans", "プラン・コース管理")}
              {nav("/admin/members", "会員管理")}
              {nav("/admin/progress", "進捗管理")}
            </>
          )}
        </nav>
        <div className="side-user">
          <b>{user.name}</b>
          {user.role === "admin" ? "管理者" : "会員"}
          <br />
          <button onClick={() => setTheme(theme === "rose" ? "standard" : "rose")}>
            🎨 {theme === "rose" ? "スタンダードに切替" : "ローズテーマに切替"}
          </button>
          <button onClick={() => { logout(); router.push("/login"); }}>ログアウト</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

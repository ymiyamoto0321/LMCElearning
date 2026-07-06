import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { DemoBanner } from "@/components/demo-banner";

export const metadata: Metadata = {
  title: "LMC e-learning",
  description: "経営・営業アカデミー オンライン講座（LMC自社e-learningシステム）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* ビューティテーマ用フォント（React 19が<head>へ自動ホイスト） */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Zen+Old+Mincho:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@300;400;500;700&display=swap"
        />
        <StoreProvider>
          <DemoBanner />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}

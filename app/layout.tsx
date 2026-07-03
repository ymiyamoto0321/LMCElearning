import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "LMC e-learning",
  description: "経営・営業アカデミー オンライン講座（LMC自社e-learningシステム）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="proto-note">🔧 <b>LMC e-learning プロトタイプ版</b>（データはブラウザ内に保存されます）</div>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}

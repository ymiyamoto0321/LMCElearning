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
        <StoreProvider>
          <DemoBanner />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}

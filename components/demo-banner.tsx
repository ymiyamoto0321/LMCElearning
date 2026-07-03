"use client";
// デモモード時のみ表示するバナー（Supabase接続時は非表示）
import { useStore } from "@/lib/store";

export function DemoBanner() {
  const { isLive } = useStore();
  if (isLive) return null;
  return (
    <div className="proto-note">
      🔧 <b>LMC e-learning プロトタイプ版</b>（データはブラウザ内に保存されます）
    </div>
  );
}

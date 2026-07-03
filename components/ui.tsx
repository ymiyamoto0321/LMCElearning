"use client";
// 共通UI部品
import React from "react";

export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="32" cy="32" r="29" fill="var(--navy-d, #12203a)" />
      <circle cx="32" cy="32" r="29" fill="none" stroke="var(--gold, #c9a63c)" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="23.5" fill="none" stroke="var(--gold, #c9a63c)" strokeWidth="1" />
      <text x="32" y="37.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--gold-l, #e8d391)" letterSpacing="1" fontFamily="Georgia,serif">LMC</text>
    </svg>
  );
}

export function ProgressBar({ pct, height = 14 }: { pct: number; height?: number }) {
  return (
    <div className="pbar" style={{ height }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function StateBadge({ state }: { state: "none" | "watch" | "done" }) {
  if (state === "done") return <span className="badge b-done">完了</span>;
  if (state === "watch") return <span className="badge b-watch">視聴済・テスト未合格</span>;
  return <span className="badge b-none">未受講</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

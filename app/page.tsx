"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Home() {
  const { user, ready } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    router.replace(user ? (user.role === "admin" ? "/admin/lessons" : "/dashboard") : "/login");
  }, [ready, user, router]);
  return null;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWallet, type WalletInfo } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function centsToYuan(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function roleLabel(role: string) {
  return role === "admin" ? "管理员" : "普通用户";
}

export default function ProfilePage() {
  const { isCheckingAuth, session } = useAuthGuard(undefined, "/profile");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

  const accountLabel = useMemo(() => {
    if (!session) {
      return "-";
    }
    return session.email || session.username || session.name || session.subjectId;
  }, [session]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await fetchWallet();
        if (active) {
          setWallet(data.wallet);
        }
      } catch {
        if (active) {
          setWallet(null);
        }
      }
    };
    if (session) {
      void run();
    }
    return () => {
      active = false;
    };
  }, [session]);

  if (isCheckingAuth || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="个人资料" description="这里展示当前登录账号和钱包数据。" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>登录身份</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-stone-600">
            <div>名称：{session.name || "-"}</div>
            <div>角色：{roleLabel(session.role)}</div>
            <div>账号 / 邮箱：{accountLabel}</div>
            <div>用户 ID：{session.subjectId}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>钱包信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-stone-600">
            <div>余额：￥{centsToYuan(wallet?.balance_cents || 0)}</div>
            <div>邀请码：{wallet?.invite_code || "-"}</div>
            <div>代理等级：{wallet?.agency_tier || "-"}</div>
            <div>订阅套餐：{wallet?.subscription_tier || "-"}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

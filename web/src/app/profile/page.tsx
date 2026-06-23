"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWallet, type WalletInfo } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

export default function ProfilePage() {
  const { isCheckingAuth, session } = useAuthGuard(undefined, "/profile");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);

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
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="个人资料" description="这里先承接新项目现有密钥身份和刚接入的钱包数据。" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader><CardTitle>登录身份</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-stone-600">
            <div>名称：{session.name}</div>
            <div>角色：{session.role}</div>
            <div>ID：{session.subjectId}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader><CardTitle>钱包信息</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-stone-600">
            <div>余额：{wallet?.balance_cents ?? 0} 分</div>
            <div>邀请码：{wallet?.invite_code || "-"}</div>
            <div>代理等级：{wallet?.agency_tier || "-"}</div>
            <div>订阅套餐：{wallet?.subscription_tier || "-"}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

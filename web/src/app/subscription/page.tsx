"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSubscriptionOrder, fetchSubscriptionPlans, type PayType, type SubscriptionPlan, type SubscriptionStatus } from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function centsToYuan(cents: number) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2);
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { isCheckingAuth } = useAuthGuard(undefined, "/subscription");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = useState<SubscriptionStatus>({ active: false });
  const [channels, setChannels] = useState<string[]>([]);
  const [selectedTier, setSelectedTier] = useState("");
  const [payType, setPayType] = useState<PayType>("alipay");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await fetchSubscriptionPlans();
        if (!active) {
          return;
        }
        if (data.enabled === false) {
          setEnabled(false);
          router.replace("/image");
          return;
        }
        const nextPlans = Array.isArray(data.plans) ? data.plans : [];
        setPlans(nextPlans);
        setStatus(data.status || { active: false });
        const nextChannels = Array.isArray(data.pay_channels) ? data.pay_channels : ["alipay"];
        setChannels(nextChannels);
        setSelectedTier(nextPlans[0]?.key || "");
        setPayType((nextChannels.includes("balance") ? "balance" : nextChannels[0] || "alipay") as PayType);
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "加载订阅失败");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [router]);

  if (isCheckingAuth || isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  if (!enabled) {
    return null;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="订阅套餐" description="这里先对齐旧版的订阅入口和下单能力，后续再继续补套餐权益细节。" />
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>当前状态</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm text-stone-600 md:grid-cols-3">
          <div>套餐：{status.tier || "未开通"}</div>
          <div>是否生效：{status.active ? "已生效" : "未生效"}</div>
          <div>到期时间：{status.expire_at || "-"}</div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.key} className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
            <CardHeader><CardTitle>{plan.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-stone-600">
              <div className="text-3xl font-semibold text-stone-900">￥{centsToYuan(plan.price_cents)}</div>
              <div>{plan.description || "-"}</div>
              <div className="space-y-1">
                {(plan.features || []).map((item) => <div key={item}>· {item}</div>)}
              </div>
              <Button
                variant={selectedTier === plan.key ? "default" : "outline"}
                className="w-full rounded-xl"
                onClick={() => setSelectedTier(plan.key)}
              >
                选择此套餐
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>创建套餐订单</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,220px,140px]">
          <Select value={selectedTier} onValueChange={setSelectedTier}>
            <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue placeholder="选择套餐" /></SelectTrigger>
            <SelectContent>{plans.map((plan) => <SelectItem key={plan.key} value={plan.key}>{plan.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={payType} onValueChange={(value) => setPayType(value as PayType)}>
            <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{channels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Button
            className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
            disabled={isSubmitting || !selectedTier}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                const data = await createSubscriptionOrder({ tier: selectedTier, pay_type: payType });
                if (data.order.pay_url) {
                  window.open(data.order.pay_url, "_blank", "noopener,noreferrer");
                }
                toast.success("套餐订单已创建");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "创建套餐订单失败");
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : "下单"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

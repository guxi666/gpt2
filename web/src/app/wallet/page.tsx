"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createPayOrder,
  createRedeemCodes,
  deleteRedeemCode,
  fetchAdminBillingOrders,
  fetchPayOrders,
  fetchRedeemCodes,
  fetchWallet,
  redeemWalletCode,
  type AdminBillingStats,
  type PayOrder,
  type PayType,
  type RedeemCode,
  type WalletInfo,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function centsToYuan(cents: number) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2);
}

function UserWalletPage() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [orders, setOrders] = useState<PayOrder[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [amount, setAmount] = useState("10");
  const [redeemCode, setRedeemCode] = useState("");
  const [payType, setPayType] = useState<PayType>("alipay");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const load = async () => {
    const [walletData, ordersData] = await Promise.all([fetchWallet(), fetchPayOrders(50)]);
    setWallet(walletData.wallet);
    const nextChannels = Array.isArray(walletData.pay_channels) ? walletData.pay_channels : [];
    setChannels(nextChannels);
    if (nextChannels.length > 0 && !nextChannels.includes(payType)) {
      setPayType(nextChannels[0] as PayType);
    }
    setOrders(Array.isArray(ordersData.items) ? ordersData.items : []);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load();
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "加载钱包失败");
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
  }, []);

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="钱包充值" description="用户视角下可充值、兑换卡密和查看自己的订单记录。" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader><CardTitle>余额</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-stone-600">
            <div className="text-3xl font-semibold text-stone-900">￥{centsToYuan(wallet?.balance_cents || 0)}</div>
            <div>累计充值：￥{centsToYuan(wallet?.total_recharge_cents || 0)}</div>
            <div>累计消费：￥{centsToYuan(wallet?.total_consume_cents || 0)}</div>
            <div>邀请码：{wallet?.invite_code || "-"}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm lg:col-span-2">
          <CardHeader><CardTitle>创建充值订单</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr,220px,120px]">
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="充值金额，单位元" className="h-10 rounded-xl border-stone-200 bg-white" />
            <Select value={payType} onValueChange={(value) => setPayType(value as PayType)}>
              <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(channels.length > 0 ? channels : ["alipay"]).map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  const data = await createPayOrder({ amount, pay_type: payType });
                  if (data.order.pay_url) {
                    window.open(data.order.pay_url, "_blank", "noopener,noreferrer");
                  }
                  await load();
                  toast.success("充值订单已创建");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "创建订单失败");
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : "下单"}
            </Button>
            <Input value={redeemCode} onChange={(event) => setRedeemCode(event.target.value)} placeholder="输入卡密兑换码" className="h-10 rounded-xl border-stone-200 bg-white md:col-span-2" />
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              disabled={isRedeeming}
              onClick={async () => {
                setIsRedeeming(true);
                try {
                  await redeemWalletCode({ code: redeemCode });
                  setRedeemCode("");
                  await load();
                  toast.success("兑换成功");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "兑换失败");
                } finally {
                  setIsRedeeming(false);
                }
              }}
            >
              {isRedeeming ? <LoaderCircle className="size-4 animate-spin" /> : "兑换"}
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>订单记录</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-sm text-stone-500">暂无订单记录</div>
          ) : orders.map((item) => (
            <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
              <div className="font-medium text-stone-900">{item.order_kind || item.type || "recharge"}</div>
              <div className="mt-1 text-stone-500">金额：￥{item.amount_yuan || centsToYuan(item.amount_cents)}</div>
              <div className="text-stone-500">状态：{item.status}</div>
              <div className="text-stone-500">时间：{item.created_at}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminWalletPage() {
  const [orders, setOrders] = useState<PayOrder[]>([]);
  const [stats, setStats] = useState<AdminBillingStats | null>(null);
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [amount, setAmount] = useState("10");
  const [count, setCount] = useState("1");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const load = async () => {
    const [ordersData, codeData] = await Promise.all([
      fetchAdminBillingOrders(200),
      fetchRedeemCodes(200),
    ]);
    setOrders(Array.isArray(ordersData.items) ? ordersData.items : []);
    setStats(ordersData.stats || null);
    setCodes(Array.isArray(codeData.items) ? codeData.items : []);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load();
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "加载钱包后台失败");
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
  }, []);

  const filteredOrders = orders.filter((item) => {
    const status = String(item.status || "").trim().toLowerCase();
    const kind = String(item.order_kind || item.type || "").trim().toLowerCase();
    if (statusFilter !== "all" && status !== statusFilter) {
      return false;
    }
    if (kindFilter !== "all" && kind !== kindFilter) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="钱包充值" description="管理员视角下可查看全站订单统计，并生成卡密。" />
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>今日营收</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">￥{stats?.today_revenue_yuan || "0.00"}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>累计营收</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">￥{stats?.total_revenue_yuan || "0.00"}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>待支付</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">{stats?.pending_count || 0}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>总订单数</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">{stats?.record_count || 0}</CardContent></Card>
      </div>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>生成卡密</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,120px,1fr,140px]">
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="面额，单位元" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={count} onChange={(event) => setCount(event.target.value)} placeholder="数量" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="备注" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Button
            className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
            disabled={isCreating}
            onClick={async () => {
              setIsCreating(true);
              try {
                await createRedeemCodes({ amount, count: Number(count || 1), note });
                setAmount("10");
                setCount("1");
                setNote("");
                await load();
                toast.success("卡密已生成");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "生成卡密失败");
              } finally {
                setIsCreating(false);
              }
            }}
          >
            {isCreating ? <LoaderCircle className="size-4 animate-spin" /> : "生成"}
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>卡密列表</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {codes.length === 0 ? <div className="text-sm text-stone-500">暂无卡密</div> : codes.map((item) => (
            <div key={item.code} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
              <div className="font-medium text-stone-900">{item.code}</div>
              <div className="mt-1 text-stone-500">面额：￥{item.amount_yuan}</div>
              <div className="text-stone-500">状态：{item.enabled ? "启用" : "禁用"} / {item.used_by ? "已使用" : "未使用"}</div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={async () => {
                    try {
                      await deleteRedeemCode(item.code);
                      await load();
                      toast.success("卡密已删除");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "删除卡密失败");
                    }
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>全站订单</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[220px,220px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="paid">paid</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="recharge">recharge</SelectItem>
                <SelectItem value="agency_join">agency_join</SelectItem>
                <SelectItem value="agency_upgrade">agency_upgrade</SelectItem>
                <SelectItem value="subscription_monthly">subscription_monthly</SelectItem>
                <SelectItem value="subscription_quarterly">subscription_quarterly</SelectItem>
                <SelectItem value="subscription_yearly">subscription_yearly</SelectItem>
                <SelectItem value="admin_adjust">admin_adjust</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filteredOrders.length === 0 ? <div className="text-sm text-stone-500">暂无订单</div> : filteredOrders.map((item) => (
            <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
              <div className="font-medium text-stone-900">{item.user_display || item.user_id || "-"}</div>
              <div className="mt-1 text-stone-500">类型：{item.order_kind || item.type || "-"}</div>
              <div className="text-stone-500">金额：￥{item.amount_yuan || centsToYuan(item.amount_cents)}</div>
              <div className="text-stone-500">状态：{item.status}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function WalletPage() {
  const { isCheckingAuth, session } = useAuthGuard(undefined, "/wallet");

  if (isCheckingAuth || !session) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return session.role === "admin" ? <AdminWalletPage /> : <UserWalletPage />;
}

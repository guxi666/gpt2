"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createPayOrder,
  fetchAdminBillingOrders,
  fetchPayOrders,
  fetchWallet,
  redeemWalletCode,
  type AdminBillingStats,
  type PayOrder,
  type PayType,
  type WalletInfo,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function centsToYuan(cents: number) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function statusBadgeVariant(status?: string) {
  switch (String(status || "").trim().toLowerCase()) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "secondary";
  }
}

function orderTypeLabel(order: PayOrder) {
  switch (String(order.order_kind || order.type || "").trim().toLowerCase()) {
    case "recharge":
      return "钱包充值";
    case "image_usage":
      return "单次生图";
    case "chat_usage":
      return "单次对话";
    case "admin_adjust":
      return "管理员调整";
    case "signup_bonus":
      return "注册赠送";
    case "agency_join":
      return "代理开通";
    case "agency_upgrade":
      return "代理升级";
    case "subscription_monthly":
      return "包月套餐";
    case "subscription_quarterly":
      return "包季套餐";
    case "subscription_yearly":
      return "包年套餐";
    default:
      return order.order_kind || order.type || "-";
  }
}

function orderPayTypeLabel(order: PayOrder) {
  switch (String(order.pay_type || order.provider || "").trim().toLowerCase()) {
    case "alipay":
      return "支付宝";
    case "wxpay":
      return "微信";
    case "balance":
      return "余额";
    case "bonus":
      return "赠送";
    default:
      return order.pay_type || order.provider || "-";
  }
}

function orderStatusLabel(status?: string) {
  switch (String(status || "").trim().toLowerCase()) {
    case "paid":
      return "已支付";
    case "pending":
      return "待支付";
    case "failed":
      return "失败";
    default:
      return status || "-";
  }
}

function orderNoLabel(order: PayOrder) {
  return order.out_trade_no || order.id || "-";
}

function payTypeOptionLabel(value: string) {
  switch (String(value || "").trim().toLowerCase()) {
    case "alipay":
      return "支付宝";
    case "wxpay":
      return "微信";
    case "balance":
      return "余额";
    case "paypal":
      return "PayPal";
    case "usdt":
      return "USDT";
    default:
      return value;
  }
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
                  <SelectItem key={item} value={item}>{payTypeOptionLabel(item)}</SelectItem>
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
          ) : (
            <div className="space-y-3">
              {orders.map((item) => (
                <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <div className="font-medium text-stone-900">{orderTypeLabel(item)}</div>
                  <div className="mt-1 text-stone-500">金额：￥{item.amount_yuan || centsToYuan(item.amount_cents)}</div>
                  <div className="text-stone-500">状态：{orderStatusLabel(item.status)}</div>
                  <div className="text-stone-500">创建时间：{formatDateTime(item.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminWalletPage() {
  const [orders, setOrders] = useState<PayOrder[]>([]);
  const [stats, setStats] = useState<AdminBillingStats | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    const ordersData = await fetchAdminBillingOrders(300);
    setOrders(Array.isArray(ordersData.items) ? ordersData.items : []);
    setStats(ordersData.stats || null);
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

  const filteredOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return orders.filter((item) => {
      const status = String(item.status || "").trim().toLowerCase();
      const kind = String(item.order_kind || item.type || "").trim().toLowerCase();
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      if (kindFilter !== "all" && kind !== kindFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return [
        item.out_trade_no,
        item.user_display,
        item.user_id,
        item.pay_type,
        item.provider,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [kindFilter, orders, query, statusFilter]);

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="钱包充值" description="管理员视角下查看全站订单统计和订单明细。" />
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>今日营收</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">￥{stats?.today_revenue_yuan || "0.00"}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>累计营收</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">￥{stats?.total_revenue_yuan || "0.00"}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>待支付</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">{stats?.pending_count || 0}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>总订单数</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">{stats?.record_count || 0}</CardContent></Card>
      </div>

      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>订单详情</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.6fr_220px_220px]">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="查询用户邮箱 / 用户ID / 订单号" className="h-10 rounded-xl border-stone-200 bg-white" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待支付</SelectItem>
                <SelectItem value="paid">已支付</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="recharge">钱包充值</SelectItem>
                <SelectItem value="agency_join">代理开通</SelectItem>
                <SelectItem value="agency_upgrade">代理升级</SelectItem>
                <SelectItem value="subscription_monthly">包月套餐</SelectItem>
                <SelectItem value="subscription_quarterly">包季套餐</SelectItem>
                <SelectItem value="subscription_yearly">包年套餐</SelectItem>
                <SelectItem value="admin_adjust">管理员调整</SelectItem>
                <SelectItem value="signup_bonus">注册赠送</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-sm text-stone-500">暂无订单</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-stone-500">
                    <th className="px-4 py-3 font-medium">订单号</th>
                    <th className="px-4 py-3 font-medium">用户邮箱</th>
                    <th className="px-4 py-3 font-medium">金额</th>
                    <th className="px-4 py-3 font-medium">类型</th>
                    <th className="px-4 py-3 font-medium">方式</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">支付时间</th>
                    <th className="px-4 py-3 font-medium">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((item) => (
                    <tr key={item.id} className="border-b border-stone-100">
                      <td className="px-4 py-3 font-mono text-xs text-stone-700">{orderNoLabel(item)}</td>
                      <td className="px-4 py-3 text-stone-700">{item.user_display || item.user_id || "-"}</td>
                      <td className="px-4 py-3 text-stone-900">￥{item.amount_yuan || centsToYuan(item.amount_cents)}</td>
                      <td className="px-4 py-3 text-stone-700">{orderTypeLabel(item)}</td>
                      <td className="px-4 py-3 text-stone-700">{orderPayTypeLabel(item)}</td>
                      <td className="px-4 py-3"><Badge variant={statusBadgeVariant(item.status)} className="rounded-md">{orderStatusLabel(item.status)}</Badge></td>
                      <td className="px-4 py-3 text-stone-700">{formatDateTime(item.paid_at)}</td>
                      <td className="px-4 py-3 text-stone-700">{formatDateTime(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

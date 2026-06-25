"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { formatBeijingDateTime } from "@/lib/time";
import { useAuthGuard } from "@/lib/use-auth-guard";

function centsToYuan(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function isRechargeOrder(order: PayOrder) {
  return String(order.order_kind || order.type || "").trim().toLowerCase() === "recharge";
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

function orderPayTypeLabel(order: PayOrder) {
  switch (String(order.pay_type || order.provider || "").trim().toLowerCase()) {
    case "alipay":
      return "支付宝";
    case "wxpay":
      return "微信";
    case "paypal":
      return "PayPal";
    case "usdt":
      return "USDT";
    default:
      return order.pay_type || order.provider || "-";
  }
}

function payTypeOptionLabel(value: string) {
  switch (String(value || "").trim().toLowerCase()) {
    case "alipay":
      return "支付宝";
    case "wxpay":
      return "微信";
    case "paypal":
      return "PayPal";
    case "usdt":
      return "USDT";
    default:
      return value;
  }
}

function orderNoLabel(order: PayOrder) {
  return order.out_trade_no || order.id || "-";
}

function orderUserLabel(order: PayOrder) {
  return order.user_display || order.user_id || "-";
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
  const isSyncingReturnRef = useRef(false);

  const load = async () => {
    const [walletData, ordersData] = await Promise.all([fetchWallet(), fetchPayOrders(100)]);
    setWallet(walletData.wallet);
    const nextChannels = Array.isArray(walletData.pay_channels) ? walletData.pay_channels : [];
    setChannels(nextChannels);
    if (nextChannels.length > 0 && !nextChannels.includes(payType)) {
      setPayType(nextChannels[0] as PayType);
    }
    setOrders((Array.isArray(ordersData.items) ? ordersData.items : []).filter(isRechargeOrder));
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

  useEffect(() => {
    if (typeof window === "undefined" || isSyncingReturnRef.current) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const outTradeNo = params.get("out_trade_no");
    const tradeStatus = params.get("trade_status");
    const sign = params.get("sign");
    if (!outTradeNo || !tradeStatus || !sign) {
      return;
    }

    isSyncingReturnRef.current = true;
    void (async () => {
      try {
        const response = await fetch(`/api/pay/yipay/notify?${params.toString()}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json().catch(() => ({ ok: false }));
        if (!response.ok) {
          throw new Error(typeof data?.detail?.error === "string" ? data.detail.error : "支付回调校验失败");
        }
        if (data.ok) {
          toast.success("支付结果已同步");
          await load();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "支付结果同步失败");
      } finally {
        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
        window.history.replaceState({}, "", cleanUrl);
        isSyncingReturnRef.current = false;
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="钱包充值" description="用户视角下可充值、兑换卡密和查看自己的充值订单。" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>余额</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-stone-600">
            <div className="text-3xl font-semibold text-stone-900">￥{centsToYuan(wallet?.balance_cents || 0)}</div>
            <div>累计充值：￥{centsToYuan(wallet?.total_recharge_cents || 0)}</div>
            <div>累计消费：￥{centsToYuan(wallet?.total_consume_cents || 0)}</div>
            <div>邀请码：{wallet?.invite_code || "-"}</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>创建充值订单</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr,220px,120px]">
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="充值金额，单位元"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <Select value={payType} onValueChange={(value) => setPayType(value as PayType)}>
              <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(channels.length > 0 ? channels : ["alipay"]).map((item) => (
                  <SelectItem key={item} value={item}>
                    {payTypeOptionLabel(item)}
                  </SelectItem>
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

            <Input
              value={redeemCode}
              onChange={(event) => setRedeemCode(event.target.value)}
              placeholder="输入卡密兑换码"
              className="h-10 rounded-xl border-stone-200 bg-white md:col-span-2"
            />
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
        <CardHeader>
          <CardTitle>充值记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-sm text-stone-500">
              暂无充值记录
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((item) => (
                <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <div className="font-medium text-stone-900">钱包充值</div>
                  <div className="mt-1 text-stone-500">订单号：{orderNoLabel(item)}</div>
                  <div className="text-stone-500">金额：￥{item.amount_yuan || centsToYuan(item.amount_cents)}</div>
                  <div className="text-stone-500">方式：{orderPayTypeLabel(item)}</div>
                  <div className="text-stone-500">状态：{orderStatusLabel(item.status)}</div>
                  <div className="text-stone-500">创建时间：{formatBeijingDateTime(item.created_at)}</div>
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

  const rechargeOrders = useMemo(() => orders.filter(isRechargeOrder), [orders]);

  const filteredOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rechargeOrders
      .filter((item) => {
        const status = String(item.status || "").trim().toLowerCase();
        if (statusFilter !== "all" && status !== statusFilter) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        return [item.out_trade_no, item.user_display, item.user_id, item.pay_type, item.provider]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
  }, [query, rechargeOrders, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="钱包充值" description="管理员视角下查看全站充值订单统计和订单明细。" />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>今日营收</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-stone-900">￥{stats?.today_revenue_yuan || "0.00"}</CardContent>
        </Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>累计营收</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-stone-900">￥{stats?.total_revenue_yuan || "0.00"}</CardContent>
        </Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>待支付</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-stone-900">{stats?.pending_count || 0}</CardContent>
        </Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>充值订单数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-stone-900">{rechargeOrders.length}</CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>订单详情</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.6fr_220px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="查询用户账号 / 用户ID / 订单号"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待支付</SelectItem>
                <SelectItem value="paid">已支付</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-sm text-stone-500">
              暂无充值订单
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-stone-500">
                    <th className="px-4 py-3 font-medium">订单号</th>
                    <th className="px-4 py-3 font-medium">用户账号</th>
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
                      <td className="px-4 py-3 text-stone-700">{orderUserLabel(item)}</td>
                      <td className="px-4 py-3 text-stone-900">￥{item.amount_yuan || centsToYuan(item.amount_cents)}</td>
                      <td className="px-4 py-3 text-stone-700">钱包充值</td>
                      <td className="px-4 py-3 text-stone-700">{orderPayTypeLabel(item)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(item.status)} className="rounded-md">
                          {orderStatusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-stone-700">{formatBeijingDateTime(item.paid_at)}</td>
                      <td className="px-4 py-3 text-stone-700">{formatBeijingDateTime(item.created_at)}</td>
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
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return session.role === "admin" ? <AdminWalletPage /> : <UserWalletPage />;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  activateAgencyUser,
  createAgencyWithdrawal,
  fetchAgencyAdminUsers,
  fetchAgencyAdminWithdrawals,
  fetchAgencyCommissionDashboard,
  fetchAgencyConfig,
  fetchAgencyWithdrawProfile,
  joinAgencyTier,
  type AgencyAdminUser,
  type AgencyCommissionDashboard,
  type AgencyConfig,
  type AgencyTier,
  type AgencyWithdrawalRequest,
  type PayType,
  updateAgencyAdminWithdrawal,
  updateAgencyWithdrawProfile,
  upgradeAgencyTier,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function centsToYuan(cents: number) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2);
}

function percentByBp(value?: number) {
  return `${((Number(value || 0)) / 100).toFixed(2)}%`;
}

function AdminView() {
  const [users, setUsers] = useState<AgencyAdminUser[]>([]);
  const [withdrawals, setWithdrawals] = useState<AgencyWithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [tier, setTier] = useState("basic");
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  const load = async () => {
    const [usersData, withdrawalData] = await Promise.all([
      fetchAgencyAdminUsers(),
      fetchAgencyAdminWithdrawals(),
    ]);
    setUsers(Array.isArray(usersData.items) ? usersData.items : []);
    setWithdrawals(Array.isArray(withdrawalData.items) ? withdrawalData.items : []);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load();
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "加载代理后台失败");
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
      <PageHeader title="代理加盟" description="管理员视角下先补齐代理用户开通和提现审核流程。" />
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>手动开通代理</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,220px,140px]">
          <Input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="输入用户 ID" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">基础代理</SelectItem>
              <SelectItem value="pro">进阶代理</SelectItem>
              <SelectItem value="premium">旗舰代理</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
            onClick={async () => {
              try {
                await activateAgencyUser({ user_id: userId, tier });
                await load();
                toast.success("代理用户已开通");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "开通代理失败");
              }
            }}
          >
            开通
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>代理用户</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {users.length === 0 ? <div className="text-sm text-stone-500">暂无代理用户</div> : users.map((item) => (
            <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
              <div className="font-medium text-stone-900">{item.name || item.id}</div>
              <div className="mt-1 text-stone-500">等级：{item.agency_tier || "-"}</div>
              <div className="text-stone-500">佣金：{percentByBp(item.agency_commission_bp)}</div>
              <div className="text-stone-500">折扣：{percentByBp(item.agency_discount_bp)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>提现审核</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {withdrawals.length === 0 ? <div className="text-sm text-stone-500">暂无提现申请</div> : withdrawals.map((item) => (
            <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
              <div className="font-medium text-stone-900">{item.user_email || item.user_id || "-"}</div>
              <div className="mt-1 text-stone-500">金额：￥{item.amount_yuan || centsToYuan(item.amount_cents)}</div>
              <div className="text-stone-500">状态：{item.status || "-"}</div>
              <div className="mt-3 flex gap-2">
                <Select value={statusMap[item.id] || item.status || "pending"} onValueChange={(value) => setStatusMap((current) => ({ ...current, [item.id]: value }))}>
                  <SelectTrigger className="h-9 w-[180px] rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="approved">approved</SelectItem>
                    <SelectItem value="paid">paid</SelectItem>
                    <SelectItem value="rejected">rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={async () => {
                    try {
                      await updateAgencyAdminWithdrawal({ id: item.id, status: (statusMap[item.id] || item.status || "pending") as "pending" | "approved" | "paid" | "rejected" });
                      await load();
                      toast.success("提现状态已更新");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "更新提现状态失败");
                    }
                  }}
                >
                  保存
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function UserView() {
  const [agency, setAgency] = useState<AgencyConfig | null>(null);
  const [dashboard, setDashboard] = useState<AgencyCommissionDashboard | null>(null);
  const [withdrawProfile, setWithdrawProfile] = useState({
    alipay_qr_code: "",
    wechat_qr_code: "",
    phone: "",
    wechat_id: "",
  });
  const [selectedTier, setSelectedTier] = useState("");
  const [payType, setPayType] = useState<PayType>("alipay");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tiers = useMemo(() => agency?.tiers || [], [agency]);

  const load = async () => {
    const [agencyData, dashboardData, profileData] = await Promise.all([
      fetchAgencyConfig(),
      fetchAgencyCommissionDashboard(),
      fetchAgencyWithdrawProfile(),
    ]);
    setAgency(agencyData);
    setDashboard(dashboardData);
    setWithdrawProfile({
      alipay_qr_code: String(profileData.profile.alipay_qr_code || ""),
      wechat_qr_code: String(profileData.profile.wechat_qr_code || ""),
      phone: String(profileData.profile.phone || ""),
      wechat_id: String(profileData.profile.wechat_id || ""),
    });
    setSelectedTier(agencyData.tiers?.[0]?.key || "");
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load();
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "加载代理页面失败");
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
      <PageHeader title="代理加盟" description="先把旧版最关键的代理下单、收益概览、提现资料和提现申请接进来。" />
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>代理等级</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">{dashboard?.agent?.tier || "未开通"}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>邀请码</CardTitle></CardHeader><CardContent className="text-xl font-semibold text-stone-900">{dashboard?.agent?.invite_code || "-"}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>可提现</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">￥{dashboard?.summary?.available_yuan || "0.00"}</CardContent></Card>
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm"><CardHeader><CardTitle>累计收益</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-stone-900">￥{dashboard?.summary?.total_commission_yuan || "0.00"}</CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((tier: AgencyTier) => (
          <Card key={tier.key} className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
            <CardHeader><CardTitle>{tier.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-stone-600">
              <div className="text-3xl font-semibold text-stone-900">￥{centsToYuan(tier.price_cents)}</div>
              <div>{tier.description || "-"}</div>
              <div>佣金比例：{percentByBp(tier.commission_bp)}</div>
              <div>用户折扣：{percentByBp(tier.discount_bp)}</div>
              <Button
                variant={selectedTier === tier.key ? "default" : "outline"}
                className="w-full rounded-xl"
                onClick={() => setSelectedTier(tier.key)}
              >
                选择此等级
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>创建代理订单</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,220px,140px]">
          <Select value={selectedTier} onValueChange={setSelectedTier}>
            <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue placeholder="选择代理等级" /></SelectTrigger>
            <SelectContent>{tiers.map((tier) => <SelectItem key={tier.key} value={tier.key}>{tier.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={payType} onValueChange={(value) => setPayType(value as PayType)}>
            <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alipay">alipay</SelectItem>
              <SelectItem value="wxpay">wxpay</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
            disabled={isSubmitting || !selectedTier}
            onClick={async () => {
              setIsSubmitting(true);
              try {
                const data = dashboard?.agent?.enabled
                  ? await upgradeAgencyTier({ tier: selectedTier, pay_type: payType })
                  : await joinAgencyTier({ tier: selectedTier, pay_type: payType });
                if (data.order.pay_url) {
                  window.open(data.order.pay_url, "_blank", "noopener,noreferrer");
                }
                toast.success("代理订单已创建");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "创建代理订单失败");
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : "下单"}
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>提现资料</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input value={withdrawProfile.alipay_qr_code} onChange={(event) => setWithdrawProfile((current) => ({ ...current, alipay_qr_code: event.target.value }))} placeholder="支付宝收款码 URL" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={withdrawProfile.wechat_qr_code} onChange={(event) => setWithdrawProfile((current) => ({ ...current, wechat_qr_code: event.target.value }))} placeholder="微信收款码 URL" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={withdrawProfile.phone} onChange={(event) => setWithdrawProfile((current) => ({ ...current, phone: event.target.value }))} placeholder="手机号" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={withdrawProfile.wechat_id} onChange={(event) => setWithdrawProfile((current) => ({ ...current, wechat_id: event.target.value }))} placeholder="微信号" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Button
            variant="outline"
            className="h-10 rounded-xl md:col-span-2"
            onClick={async () => {
              try {
                await updateAgencyWithdrawProfile(withdrawProfile);
                toast.success("提现资料已保存");
                await load();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "保存提现资料失败");
              }
            }}
          >
            保存提现资料
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>申请提现</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,160px]">
          <Input value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="提现金额，单位元" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Button
            className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
            onClick={async () => {
              try {
                const amount_cents = Math.round(Number(withdrawAmount || 0) * 100);
                await createAgencyWithdrawal({ amount_cents, ...withdrawProfile });
                setWithdrawAmount("");
                toast.success("提现申请已提交");
                await load();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "提交提现失败");
              }
            }}
          >
            提交
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>收益与提现记录</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[...(dashboard?.orders || []), ...((dashboard?.withdrawals as AgencyWithdrawalRequest[] | undefined) || [])].length === 0 ? (
            <div className="text-sm text-stone-500">暂无数据</div>
          ) : (
            <>
              {(dashboard?.orders || []).map((item) => (
                <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <div className="font-medium text-stone-900">订单收益</div>
                  <div className="mt-1 text-stone-500">金额：￥{item.amount_yuan || centsToYuan(item.amount_cents)}</div>
                  <div className="text-stone-500">佣金：￥{item.commission_yuan || centsToYuan(item.commission_cents)}</div>
                  <div className="text-stone-500">状态：{item.status || "-"}</div>
                </div>
              ))}
              {(dashboard?.withdrawals || []).map((item) => (
                <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <div className="font-medium text-stone-900">提现申请</div>
                  <div className="mt-1 text-stone-500">金额：￥{item.amount_yuan || centsToYuan(item.amount_cents)}</div>
                  <div className="text-stone-500">状态：{item.status || "-"}</div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AgencyPage() {
  const { isCheckingAuth, session } = useAuthGuard(undefined, "/agency");

  if (isCheckingAuth || !session) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return session.role === "admin" ? <AdminView /> : <UserView />;
}

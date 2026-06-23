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
  adjustManagedUserBalance,
  adjustManagedUserSubscription,
  createManagedUser,
  deleteManagedUser,
  fetchManagedRoles,
  fetchManagedUsers,
  importLegacyData,
  resetManagedUserKey,
  type ManagedRole,
  type ManagedUser,
  updateManagedUser,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function centsToYuan(cents: number) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2);
}

export default function UsersPage() {
  const { isCheckingAuth, session } = useAuthGuard(["admin"]);
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [newKey, setNewKey] = useState("");
  const [legacySourcePath, setLegacySourcePath] = useState("");
  const [balanceValue, setBalanceValue] = useState<Record<string, string>>({});
  const [subscriptionTier, setSubscriptionTier] = useState<Record<string, string>>({});

  const load = async () => {
    const [usersData, rolesData] = await Promise.all([fetchManagedUsers(), fetchManagedRoles()]);
    const nextItems = Array.isArray(usersData.items) ? usersData.items : [];
    setItems(nextItems);
    const nextRoles = Array.isArray(rolesData.items) ? rolesData.items : [];
    setRoles(nextRoles);
    if (!roleId) {
      setRoleId(nextRoles[0]?.id || "");
    }
    const nextBalanceMap: Record<string, string> = {};
    const nextSubscriptionMap: Record<string, string> = {};
    nextItems.forEach((item) => {
      nextBalanceMap[item.id] = centsToYuan(Number(item.balance_cents || 0));
      nextSubscriptionMap[item.id] = String(item.subscription_tier || "monthly") || "monthly";
    });
    setBalanceValue(nextBalanceMap);
    setSubscriptionTier(nextSubscriptionMap);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load();
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "加载用户失败");
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

  if (isCheckingAuth || !session || isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="用户管理" description="这版已经不是纯密钥列表了，管理员可以直接调余额、改订阅、换角色、禁用和删用户。" />
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>导入旧数据库</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,160px]">
          <Input value={legacySourcePath} onChange={(event) => setLegacySourcePath(event.target.value)} placeholder="旧项目目录或旧 sqlite 文件路径" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Button
            className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
            onClick={async () => {
              try {
                const data = await importLegacyData(legacySourcePath);
                await load();
                setNewKey(data.created_keys?.map((item) => `${item.username}: ${item.key}`).join("\n") || "");
                toast.success(`导入完成，角色 ${data.roles_imported}，用户 ${data.users_imported}，钱包 ${data.billing_profiles_imported}`);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "导入旧数据库失败");
              }
            }}
          >
            导入
          </Button>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>创建用户</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,1fr,1fr,220px,140px]">
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用户名" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="显示名称" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="占位密码（当前仅用于兼容旧版表单）" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white"><SelectValue placeholder="选择角色" /></SelectTrigger>
            <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button
            className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
            onClick={async () => {
              try {
                const data = await createManagedUser({
                  username,
                  name: name || username,
                  password,
                  role_id: roleId,
                  enabled: true,
                });
                setItems(Array.isArray(data.items) ? data.items : []);
                setUsername("");
                setName("");
                setPassword("");
                setNewKey(data.key || "");
                await load();
                toast.success("用户已创建");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "创建用户失败");
              }
            }}
          >
            创建
          </Button>
        </CardContent>
      </Card>
      {newKey ? (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50 shadow-sm">
          <CardHeader><CardTitle>新密钥</CardTitle></CardHeader>
          <CardContent className="font-mono text-sm text-emerald-900">{newKey}</CardContent>
        </Card>
      ) : null}
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>用户列表</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? <div className="text-sm text-stone-500">暂无用户</div> : items.map((item) => (
            <div key={item.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
              <div className="font-medium text-stone-900">{item.name || item.username || item.id}</div>
              <div className="mt-1 grid gap-1 text-stone-500 md:grid-cols-2">
                <div>用户名：{item.username || "-"}</div>
                <div>角色：{item.role_name || "-"}</div>
                <div>余额：￥{centsToYuan(Number(item.balance_cents || 0))}</div>
                <div>订阅：{item.subscription_tier || "-"} / {item.subscription_active ? "生效中" : "未生效"}</div>
                <div>代理等级：{item.agency_tier || "-"}</div>
                <div>状态：{item.enabled ? "启用" : "禁用"}</div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[220px,160px,180px,140px]">
                <Select
                  value={item.role_id || ""}
                  onValueChange={async (value) => {
                    try {
                      const data = await updateManagedUser(item.id, { role_id: value });
                      setItems(Array.isArray(data.items) ? data.items : []);
                      await load();
                      toast.success("用户角色已更新");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "更新用户角色失败");
                    }
                  }}
                >
                  <SelectTrigger className="h-9 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input
                  value={balanceValue[item.id] || ""}
                  onChange={(event) => setBalanceValue((current) => ({ ...current, [item.id]: event.target.value }))}
                  placeholder="余额（元）"
                  className="h-9 rounded-xl border-stone-200 bg-white"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl"
                    onClick={async () => {
                      try {
                        const nextBalance = Math.round(Number(balanceValue[item.id] || "0") * 100);
                        await adjustManagedUserBalance(item.id, { balance_cents: nextBalance, note: "admin set balance" });
                        await load();
                        toast.success("余额已更新");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "更新余额失败");
                      }
                    }}
                  >
                    改余额
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl"
                    onClick={async () => {
                      try {
                        const data = await updateManagedUser(item.id, { enabled: !item.enabled });
                        setItems(Array.isArray(data.items) ? data.items : []);
                        await load();
                        toast.success(item.enabled ? "用户已禁用" : "用户已启用");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "更新用户状态失败");
                      }
                    }}
                  >
                    {item.enabled ? "禁用" : "启用"}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={async () => {
                    try {
                      const data = await resetManagedUserKey(item.id, item.name);
                      setItems(Array.isArray(data.items) ? data.items : []);
                      setNewKey(data.key || "");
                      await load();
                      toast.success("用户密钥已重置");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "重置用户密钥失败");
                    }
                  }}
                >
                  重置密钥
                </Button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[220px,140px,140px]">
                <Select
                  value={subscriptionTier[item.id] || "monthly"}
                  onValueChange={(value) => setSubscriptionTier((current) => ({ ...current, [item.id]: value }))}
                >
                  <SelectTrigger className="h-9 rounded-xl border-stone-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">包月</SelectItem>
                    <SelectItem value="quarterly">包季</SelectItem>
                    <SelectItem value="yearly">包年</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={async () => {
                    try {
                      await adjustManagedUserSubscription(item.id, { mode: "set", tier: subscriptionTier[item.id] || "monthly" });
                      await load();
                      toast.success("订阅已设置");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "设置订阅失败");
                    }
                  }}
                >
                  设订阅
                </Button>
                <Button
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={async () => {
                    try {
                      await adjustManagedUserSubscription(item.id, { mode: "clear" });
                      await load();
                      toast.success("订阅已清除");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "清除订阅失败");
                    }
                  }}
                >
                  清订阅
                </Button>
              </div>
              <div className="mt-3">
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={async () => {
                    try {
                      const data = await deleteManagedUser(item.id);
                      setItems(Array.isArray(data.items) ? data.items : []);
                      await load();
                      toast.success("用户已删除");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "删除用户失败");
                    }
                  }}
                >
                  删除用户
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

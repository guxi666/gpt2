"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  adjustManagedUserBalance,
  adjustManagedUserSubscription,
  createManagedUser,
  deleteManagedUser,
  fetchManagedRoles,
  fetchManagedUsers,
  resetManagedUserKey,
  updateManagedUser,
  type ManagedRole,
  type ManagedUser,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const SUBSCRIPTION_OPTIONS = [
  { value: "monthly", label: "包月" },
  { value: "quarterly", label: "包季" },
  { value: "yearly", label: "包年" },
] as const;

type ProviderFilter = "all" | "local" | "email" | "legacy_import";
type StatusFilter = "all" | "enabled" | "disabled";

function centsToYuan(cents: number) {
  return (Math.max(0, Number(cents || 0)) / 100).toFixed(2);
}

function providerLabel(provider?: string) {
  if (provider === "email") return "邮箱";
  if (provider === "legacy_import") return "导入";
  if (provider === "local") return "本地";
  return "其他";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
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

function displayEmail(email?: string | null) {
  const raw = String(email || "").trim();
  if (!raw) return "-";
  if (raw.toLowerCase().endsWith("@local.invalid")) return "-";
  const match = raw.match(/^local[a-z0-9-]*_(.+@.+)$/i);
  return match?.[1] || raw;
}

function userSearchText(user: ManagedUser) {
  return [
    user.id,
    user.username,
    user.email,
    user.name,
    user.provider,
    user.role_name,
    user.api_key_id,
    user.api_key_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function UsersContent() {
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  const [searchText, setSearchText] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(1);

  const [revealedKeysById, setRevealedKeysById] = useState<Record<string, string>>({});

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRoleId, setCreateRoleId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [balanceUser, setBalanceUser] = useState<ManagedUser | null>(null);
  const [balanceValue, setBalanceValue] = useState("0.00");
  const [balanceNote, setBalanceNote] = useState("");

  const [roleUser, setRoleUser] = useState<ManagedUser | null>(null);
  const [nextRoleId, setNextRoleId] = useState("");

  const [subscriptionUser, setSubscriptionUser] = useState<ManagedUser | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState("monthly");

  const [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null);

  const setUserPending = (userId: string, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const loadUsers = async () => {
    try {
      const [usersData, rolesData] = await Promise.all([fetchManagedUsers(), fetchManagedRoles()]);
      const nextItems = Array.isArray(usersData.items) ? usersData.items : [];
      const nextRoles = Array.isArray(rolesData.items) ? rolesData.items : [];
      setItems(nextItems);
      setRoles(nextRoles);
      setCreateRoleId((current) => current || nextRoles[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载用户失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return items.filter((user) => {
      if (providerFilter !== "all" && String(user.provider || "") !== providerFilter) return false;
      if (statusFilter === "enabled" && !user.enabled) return false;
      if (statusFilter === "disabled" && user.enabled) return false;
      return !keyword || userSearchText(user).includes(keyword);
    });
  }, [items, providerFilter, searchText, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage((prev) => Math.max(1, Math.min(prev, totalPages)));
  }, [totalPages]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [currentPage, filteredItems, pageSize]);

  const hasActiveFilters = searchText.trim() !== "" || providerFilter !== "all" || statusFilter !== "all";

  const handleCreate = async () => {
    const username = createUsername.trim();
    const password = createPassword.trim();
    if (!username || !password) {
      toast.error("请填写用户名和密码");
      return;
    }
    setIsCreating(true);
    try {
      const data = await createManagedUser({
        username,
        name: createName.trim() || username,
        password,
        role_id: createRoleId || undefined,
        enabled: true,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.item?.id && data.key) {
        setRevealedKeysById((current) => ({ ...current, [data.item.id]: data.key }));
      }
      setCreateUsername("");
      setCreateName("");
      setCreatePassword("");
      setIsCreateDialogOpen(false);
      toast.success("用户已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建用户失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleUser = async (user: ManagedUser) => {
    setUserPending(user.id, true);
    try {
      const data = await updateManagedUser(user.id, { enabled: !user.enabled });
      setItems(Array.isArray(data.items) ? data.items : []);
      toast.success(user.enabled ? "用户已禁用" : "用户已启用");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新用户状态失败");
    } finally {
      setUserPending(user.id, false);
    }
  };

  const handleResetKey = async (user: ManagedUser) => {
    setUserPending(user.id, true);
    try {
      const data = await resetManagedUserKey(user.id, user.api_key_name || user.name || user.username || "");
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.key) {
        const nextId = String(data.item?.id || user.id);
        setRevealedKeysById((current) => {
          const next = { ...current };
          delete next[user.id];
          next[nextId] = data.key;
          return next;
        });
      }
      toast.success(user.has_api_key ? "密钥已重置" : "密钥已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "处理密钥失败");
    } finally {
      setUserPending(user.id, false);
    }
  };

  const handleToggleKeyVisible = (user: ManagedUser) => {
    if (revealedKeysById[user.id]) {
      setRevealedKeysById((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      return;
    }
    toast.error("旧密钥无法直接回显，请先重置密钥");
  };

  const handleBalanceSave = async () => {
    if (!balanceUser) return;
    const nextBalance = Math.round(Number(balanceValue || "0") * 100);
    if (!Number.isFinite(nextBalance)) {
      toast.error("请输入有效金额");
      return;
    }
    setUserPending(balanceUser.id, true);
    try {
      await adjustManagedUserBalance(balanceUser.id, {
        balance_cents: Math.max(0, nextBalance),
        note: balanceNote.trim() || "admin set balance",
      });
      await loadUsers();
      setBalanceUser(null);
      toast.success("余额已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新余额失败");
    } finally {
      setUserPending(balanceUser.id, false);
    }
  };

  const handleRoleSave = async () => {
    if (!roleUser || !nextRoleId) return;
    setUserPending(roleUser.id, true);
    try {
      const data = await updateManagedUser(roleUser.id, { role_id: nextRoleId });
      setItems(Array.isArray(data.items) ? data.items : []);
      setRoleUser(null);
      toast.success("角色已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新角色失败");
    } finally {
      setUserPending(roleUser.id, false);
    }
  };

  const handleSubscriptionSave = async () => {
    if (!subscriptionUser) return;
    setUserPending(subscriptionUser.id, true);
    try {
      await adjustManagedUserSubscription(subscriptionUser.id, {
        mode: "set",
        tier: subscriptionTier,
      });
      await loadUsers();
      setSubscriptionUser(null);
      toast.success("订阅已设置");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "设置订阅失败");
    } finally {
      setUserPending(subscriptionUser.id, false);
    }
  };

  const handleSubscriptionClear = async () => {
    if (!subscriptionUser) return;
    setUserPending(subscriptionUser.id, true);
    try {
      await adjustManagedUserSubscription(subscriptionUser.id, { mode: "clear" });
      await loadUsers();
      setSubscriptionUser(null);
      toast.success("订阅已清除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "清除订阅失败");
    } finally {
      setUserPending(subscriptionUser.id, false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setUserPending(deleteUser.id, true);
    try {
      const data = await deleteManagedUser(deleteUser.id);
      setItems(Array.isArray(data.items) ? data.items : []);
      setDeleteUser(null);
      toast.success("用户已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除用户失败");
    } finally {
      setUserPending(deleteUser.id, false);
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="用户"
        title="用户管理"
        actions={(
          <>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => void loadUsers()} disabled={isLoading}>
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="size-4" />
              创建用户
            </Button>
          </>
        )}
      />

      <Card className="overflow-hidden rounded-[26px] border-white/80 bg-white/92 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-stone-100 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
              <span>总计 {filteredItems.length} / {items.length}</span>
              <div className="flex items-center gap-2">
                <span>每页</span>
                <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                  <SelectTrigger className="h-9 w-[96px] rounded-xl border-stone-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 lg:grid-cols-[minmax(18rem,1fr)_160px_160px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={searchText}
                  onChange={(event) => { setSearchText(event.target.value); setPage(1); }}
                  placeholder="搜索 ID/用户名/邮箱/密钥"
                  className="h-10 rounded-xl border-stone-200 bg-white pl-9"
                />
              </div>

              <Select value={providerFilter} onValueChange={(value) => { setProviderFilter(value as ProviderFilter); setPage(1); }}>
                <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  <SelectItem value="local">本地</SelectItem>
                  <SelectItem value="email">邮箱</SelectItem>
                  <SelectItem value="legacy_import">导入</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as StatusFilter); setPage(1); }}>
                <SelectTrigger className="h-10 rounded-xl border-stone-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">禁用</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-500"
                disabled={!hasActiveFilters}
                onClick={() => {
                  setSearchText("");
                  setProviderFilter("all");
                  setStatusFilter("all");
                  setPage(1);
                }}
              >
                <X className="size-4" />
                清空筛选
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[1420px]">
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>余额</TableHead>
                  <TableHead>用户密钥</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="w-[360px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map((user) => {
                  const pending = pendingIds.has(user.id);
                  const visibleKey = revealedKeysById[user.id] || "";
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="truncate font-medium text-stone-900">
                            {user.name || user.username || user.id}
                          </div>
                          <div className="truncate text-xs text-stone-500">Email: {displayEmail(user.email)}</div>
                          <div className="truncate text-xs text-stone-500">用户名: {user.username || "-"}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="rounded-full bg-stone-100 text-stone-700">
                          {providerLabel(user.provider)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="rounded-full bg-stone-100 text-stone-700">
                          {user.role_name || "普通用户"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant={user.enabled ? "success" : "danger"} className="rounded-full">
                          {user.enabled ? "启用" : "禁用"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-base font-semibold text-stone-900">¥ {centsToYuan(Number(user.balance_cents || 0))}</div>
                          <div className="text-xs text-stone-500">总充值 ¥ {centsToYuan(Number(user.total_recharge_cents || 0))}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="max-w-[260px] space-y-1">
                          <div className="truncate text-xs text-stone-500">密钥ID: {user.api_key_id || "-"}</div>
                          <div className="flex items-center gap-2 rounded-[16px] border border-stone-200 bg-stone-50 px-3 py-2">
                            <code className="min-w-0 flex-1 truncate font-mono text-xs text-stone-700">
                              {visibleKey || (user.has_api_key ? "************************" : "未生成")}
                            </code>
                            {visibleKey ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg"
                                onClick={() => void copyText(visibleKey).then(() => toast.success("已复制")).catch(() => toast.error("复制失败"))}
                              >
                                <Copy className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1 text-xs text-stone-600">
                          <div>创建: {formatDateTime(user.created_at)}</div>
                          <div>最近: {formatDateTime(user.last_used_at)}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" variant="outline" className="h-8 rounded-xl px-3" onClick={() => handleToggleKeyVisible(user)} disabled={!user.has_api_key && !revealedKeysById[user.id]}>
                            {visibleKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            {visibleKey ? "隐藏" : "显示"}
                          </Button>

                          <Button type="button" variant="outline" className="h-8 rounded-xl px-3" onClick={() => void handleResetKey(user)} disabled={pending}>
                            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                            {user.has_api_key ? "重置密钥" : "创建密钥"}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl px-3"
                            onClick={() => {
                              setBalanceUser(user);
                              setBalanceValue(centsToYuan(Number(user.balance_cents || 0)));
                              setBalanceNote("");
                            }}
                          >
                            <Wallet className="size-4" />
                            调整余额
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl px-3"
                            onClick={() => {
                              setRoleUser(user);
                              setNextRoleId(user.role_id || roles[0]?.id || "");
                            }}
                          >
                            <Shield className="size-4" />
                            改角色
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl px-3"
                            onClick={() => {
                              setSubscriptionUser(user);
                              setSubscriptionTier(user.subscription_tier || "monthly");
                            }}
                          >
                            订阅设置
                          </Button>

                          <Button type="button" variant="outline" className="h-8 rounded-xl px-3" onClick={() => void handleToggleUser(user)} disabled={pending}>
                            {pending ? <LoaderCircle className="size-4 animate-spin" /> : user.enabled ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
                            {user.enabled ? "禁用" : "启用"}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl border-rose-200 px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => setDeleteUser(user)}
                            disabled={pending}
                          >
                            <Trash2 className="size-4" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-14">
              <LoaderCircle className="size-5 animate-spin text-stone-400" />
            </div>
          ) : null}

          {!isLoading && filteredItems.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-stone-500">
              {items.length === 0 ? "暂无用户" : "没有匹配的用户"}
            </div>
          ) : null}

          {!isLoading && filteredItems.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-3 text-sm text-stone-500">
              <span>第 {currentPage} / {totalPages} 页</span>
              <div className="flex items-center gap-2">
                <Input
                  value={String(currentPage)}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    setPage(Math.max(1, Math.min(totalPages, Math.trunc(next))));
                  }}
                  inputMode="numeric"
                  className="h-8 w-[120px] rounded-xl border-stone-200 bg-white"
                  placeholder={`页码 1-${totalPages}`}
                />
                <Button type="button" variant="outline" className="h-8 rounded-xl px-3" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  上一页
                </Button>
                <Button type="button" variant="outline" className="h-8 rounded-xl px-3" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-[28px] p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>创建用户</DialogTitle>
            <DialogDescription>创建本地后台用户，创建后会直接返回一把新密钥。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input value={createUsername} onChange={(event) => setCreateUsername(event.target.value)} placeholder="用户名" className="h-11 rounded-xl border-stone-200 bg-white" />
            <Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="显示名称" className="h-11 rounded-xl border-stone-200 bg-white" />
            <Input type="password" value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} placeholder="密码占位，保留旧版表单习惯" className="h-11 rounded-xl border-stone-200 bg-white" />
            <Select value={createRoleId} onValueChange={setCreateRoleId}>
              <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" className="h-10 rounded-xl px-5" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>取消</Button>
            <Button type="button" className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800" onClick={() => void handleCreate()} disabled={isCreating}>
              {isCreating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(balanceUser)} onOpenChange={(open) => (!open ? setBalanceUser(null) : null)}>
        <DialogContent className="rounded-[28px] p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>调整余额</DialogTitle>
            <DialogDescription>这里按旧版习惯直接设定用户当前余额。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input value={balanceValue} onChange={(event) => setBalanceValue(event.target.value)} placeholder="余额（元）" className="h-11 rounded-xl border-stone-200 bg-white" />
            <Input value={balanceNote} onChange={(event) => setBalanceNote(event.target.value)} placeholder="备注（可选）" className="h-11 rounded-xl border-stone-200 bg-white" />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" className="h-10 rounded-xl px-5" onClick={() => setBalanceUser(null)} disabled={balanceUser ? pendingIds.has(balanceUser.id) : false}>取消</Button>
            <Button type="button" className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800" onClick={() => void handleBalanceSave()} disabled={balanceUser ? pendingIds.has(balanceUser.id) : false}>
              {balanceUser && pendingIds.has(balanceUser.id) ? <LoaderCircle className="size-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(roleUser)} onOpenChange={(open) => (!open ? setRoleUser(null) : null)}>
        <DialogContent className="rounded-[28px] p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>修改角色</DialogTitle>
            <DialogDescription>切换后会同步更新该用户的菜单权限和接口权限。</DialogDescription>
          </DialogHeader>
          <Select value={nextRoleId} onValueChange={setNextRoleId}>
            <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white">
              <SelectValue placeholder="选择角色" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="secondary" className="h-10 rounded-xl px-5" onClick={() => setRoleUser(null)} disabled={roleUser ? pendingIds.has(roleUser.id) : false}>取消</Button>
            <Button type="button" className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800" onClick={() => void handleRoleSave()} disabled={roleUser ? pendingIds.has(roleUser.id) : false}>
              {roleUser && pendingIds.has(roleUser.id) ? <LoaderCircle className="size-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(subscriptionUser)} onOpenChange={(open) => (!open ? setSubscriptionUser(null) : null)}>
        <DialogContent className="rounded-[28px] p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>订阅设置</DialogTitle>
            <DialogDescription>可以直接给用户设置套餐，或者清除当前套餐。</DialogDescription>
          </DialogHeader>
          <Select value={subscriptionTier} onValueChange={setSubscriptionTier}>
            <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBSCRIPTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10 rounded-xl px-5" onClick={() => void handleSubscriptionClear()} disabled={subscriptionUser ? pendingIds.has(subscriptionUser.id) : false}>清除套餐</Button>
            <Button type="button" variant="secondary" className="h-10 rounded-xl px-5" onClick={() => setSubscriptionUser(null)} disabled={subscriptionUser ? pendingIds.has(subscriptionUser.id) : false}>取消</Button>
            <Button type="button" className="h-10 rounded-xl bg-stone-950 px-5 text-white hover:bg-stone-800" onClick={() => void handleSubscriptionSave()} disabled={subscriptionUser ? pendingIds.has(subscriptionUser.id) : false}>
              {subscriptionUser && pendingIds.has(subscriptionUser.id) ? <LoaderCircle className="size-4 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteUser)} onOpenChange={(open) => (!open ? setDeleteUser(null) : null)}>
        <DialogContent className="rounded-[28px] p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>删除用户</DialogTitle>
            <DialogDescription>确认删除后，这个用户及其关联密钥会一起移除。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" className="h-10 rounded-xl px-5" onClick={() => setDeleteUser(null)} disabled={deleteUser ? pendingIds.has(deleteUser.id) : false}>取消</Button>
            <Button type="button" className="h-10 rounded-xl bg-rose-600 px-5 text-white hover:bg-rose-700" onClick={() => void handleDelete()} disabled={deleteUser ? pendingIds.has(deleteUser.id) : false}>
              {deleteUser && pendingIds.has(deleteUser.id) ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function UsersPage() {
  const { isCheckingAuth, session } = useAuthGuard(["admin"]);

  if (isCheckingAuth || !session || session.role !== "admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return <UsersContent />;
}

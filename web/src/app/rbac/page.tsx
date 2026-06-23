"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { PermissionEditor } from "@/components/permission-editor";
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
import {
  adjustManagedUserSubscription,
  createManagedRole,
  deleteManagedRole,
  fetchManagedRoles,
  fetchManagedUsers,
  fetchPermissionCatalog,
  updateManagedRole,
  updateManagedUser,
  type ApiPermission,
  type ManagedRole,
  type ManagedUser,
  type PermissionMenu,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { cn } from "@/lib/utils";

function normalizeManagedRoles(items: ManagedRole[] | null | undefined) {
  return Array.isArray(items) ? items : [];
}

function uniqueSortedStrings(values: string[] | null | undefined) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((v) => String(v || "").trim()).filter(Boolean))).sort();
}

function sameStringSet(left: string[], right: string[] | null | undefined) {
  const l = uniqueSortedStrings(left);
  const r = uniqueSortedStrings(right);
  if (l.length !== r.length) return false;
  return l.every((value, index) => value === r[index]);
}

function roleSearchText(role: ManagedRole) {
  return [role.id, role.name, role.description].filter(Boolean).join(" ").toLowerCase();
}

function permissionCountLabel(role: ManagedRole) {
  return `${uniqueSortedStrings(role.menu_paths).length} 菜单 / ${uniqueSortedStrings(role.api_permissions).length} API`;
}

function displayEmail(email?: string | null) {
  const raw = String(email || "").trim();
  if (!raw) return "-";
  const match = raw.match(/^local[a-z0-9-]*_(.+@.+)$/i);
  return match?.[1] || raw;
}

function managedUserDisplayName(user: ManagedUser, duplicatedNames: Set<string>) {
  const name = String(user.name || user.username || user.id || "").trim();
  const email = displayEmail(user.email);
  if (name && duplicatedNames.has(name.toLowerCase()) && email !== "-") {
    return `${name}（${email}）`;
  }
  return name || email || user.id || "用户";
}

function subscriptionTierLabel(tier?: string | null) {
  switch (String(tier || "").trim()) {
    case "monthly":
      return "包月";
    case "quarterly":
      return "包季";
    case "yearly":
      return "包年";
    default:
      return "-";
  }
}

function parseDateTime(value?: string | null) {
  if (!value) return null;
  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value?: string | null) {
  const date = parseDateTime(value);
  if (!date) return "-";
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

function subscriptionRemainingLabel(user: ManagedUser) {
  if (!user.subscription_active) return "-";
  const expireAt = parseDateTime(user.subscription_expire_at);
  if (!expireAt) return "-";
  const remainingMs = expireAt.getTime() - Date.now();
  if (remainingMs <= 0) return "0 天";
  return `${Math.ceil(remainingMs / 86400000)} 天`;
}

function roleMatchesUser(role: ManagedRole, user: ManagedUser) {
  const roleId = String(role.id || "").trim();
  const roleName = String(role.name || "").trim();
  const userRoleId = String(user.role_id || "").trim();
  const userRoleName = String(user.role_name || "").trim();
  const roleSubscriptionTier = String(role.subscription_tier || "").trim();
  const roleAgencyTier = String(role.agency_tier || "").trim();
  return Boolean(
    (roleId && userRoleId === roleId)
    || (roleName && userRoleName === roleName)
    || (roleSubscriptionTier && user.subscription_active && String(user.subscription_tier || "").trim() === roleSubscriptionTier)
    || (roleAgencyTier && String(user.agency_tier || "").trim() === roleAgencyTier),
  );
}

function RBACContent() {
  const selectedRoleIdRef = useRef("");

  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [catalog, setCatalog] = useState<{ menus: PermissionMenu[]; apis: ApiPermission[] }>({ menus: [], apis: [] });

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedMenuPaths, setSelectedMenuPaths] = useState<string[]>([]);
  const [selectedApiPermissions, setSelectedApiPermissions] = useState<string[]>([]);

  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [deletingRole, setDeletingRole] = useState<ManagedRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingUserIds, setUpdatingUserIds] = useState<Set<string>>(() => new Set());
  const [editingSubscriptionUserId, setEditingSubscriptionUserId] = useState("");
  const [subscriptionAdjustMode, setSubscriptionAdjustMode] = useState<"set" | "extend" | "clear">("extend");
  const [subscriptionAdjustTier, setSubscriptionAdjustTier] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [subscriptionAdjustExpireAt, setSubscriptionAdjustExpireAt] = useState("");
  const [subscriptionExtendDays, setSubscriptionExtendDays] = useState("30");

  useEffect(() => {
    selectedRoleIdRef.current = selectedRoleId;
  }, [selectedRoleId]);

  const applySelectedRole = useCallback((role: ManagedRole | null | undefined) => {
    setSelectedRoleId(role?.id || "");
    setRoleName(role?.name || "");
    setRoleDescription(role?.description || "");
    setSelectedMenuPaths(uniqueSortedStrings(role?.menu_paths));
    setSelectedApiPermissions(uniqueSortedStrings(role?.api_permissions));
  }, []);

  const loadRBAC = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesData, catalogData] = await Promise.all([
        fetchManagedRoles(),
        fetchPermissionCatalog(),
      ]);
      const nextRoles = normalizeManagedRoles(rolesData.items);
      const nextCatalog = {
        menus: Array.isArray(catalogData.menus) ? catalogData.menus : [],
        apis: Array.isArray(catalogData.apis) ? catalogData.apis : [],
      };
      const currentId = selectedRoleIdRef.current;
      const nextSelected = nextRoles.find((item) => item.id === currentId) || nextRoles[0] || null;
      setRoles(nextRoles);
      setCatalog(nextCatalog);
      applySelectedRole(nextSelected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载角色权限失败");
    } finally {
      setIsLoading(false);
    }
  }, [applySelectedRole]);

  const loadRoleMembers = useCallback(async () => {
    setIsMembersLoading(true);
    try {
      const usersData = await fetchManagedUsers();
      setUsers(Array.isArray(usersData.items) ? usersData.items : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载角色成员失败");
    } finally {
      setIsMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRBAC();
    void loadRoleMembers();
  }, [loadRBAC, loadRoleMembers]);

  const selectedRole = useMemo(() => roles.find((item) => item.id === selectedRoleId) || null, [roles, selectedRoleId]);

  const filteredRoles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return roles;
    return roles.filter((role) => roleSearchText(role).includes(keyword));
  }, [roles, searchText]);

  const duplicatedUserNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of users) {
      const name = String(user.name || user.username || "").trim().toLowerCase();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([name]) => name));
  }, [users]);

  const roleMembers = useMemo(() => {
    if (!selectedRole) return [];
    return users
      .filter((user) => roleMatchesUser(selectedRole, user))
      .sort((a, b) => (a.name || a.username || a.email || a.id || "").localeCompare(b.name || b.username || b.email || b.id || "", "zh-CN"));
  }, [selectedRole, users]);

  const roleMemberStats = useMemo(() => {
    const counts = new Map<string, number>();
    const previews = new Map<string, string>();
    for (const role of roles) {
      const members = users.filter((user) => roleMatchesUser(role, user));
      counts.set(role.id, members.length);
      if (members.length > 0) {
        const preview = members.slice(0, 3).map((user) => managedUserDisplayName(user, duplicatedUserNames)).join("、");
        previews.set(role.id, members.length > 3 ? `${preview} 等 ${members.length} 人` : preview);
      }
    }
    return { counts, previews };
  }, [duplicatedUserNames, roles, users]);

  const isDirty = Boolean(selectedRole)
    && (roleName.trim() !== (selectedRole?.name || "")
      || roleDescription.trim() !== (selectedRole?.description || "")
      || !sameStringSet(selectedMenuPaths, selectedRole?.menu_paths)
      || !sameStringSet(selectedApiPermissions, selectedRole?.api_permissions));

  const handleSave = async () => {
    if (!selectedRole || isSaving) return;
    const name = roleName.trim();
    if (!name) {
      toast.error("角色名称不能为空");
      return;
    }
    setIsSaving(true);
    try {
      const data = await updateManagedRole(selectedRole.id, {
        name,
        description: roleDescription.trim(),
        menu_paths: selectedMenuPaths,
        api_permissions: selectedApiPermissions,
      });
      const nextRoles = normalizeManagedRoles(data.items);
      setRoles(nextRoles);
      applySelectedRole(nextRoles.find((role) => role.id === data.item.id) || data.item);
      toast.success("角色已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存角色失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error("角色名称不能为空");
      return;
    }
    setIsCreating(true);
    try {
      const data = await createManagedRole({ name, description: createDescription.trim() });
      const nextRoles = normalizeManagedRoles(data.items);
      setRoles(nextRoles);
      applySelectedRole(nextRoles.find((role) => role.id === data.item.id) || data.item);
      setCreateName("");
      setCreateDescription("");
      setIsCreateDialogOpen(false);
      toast.success("角色已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建角色失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRole || isDeleting) return;
    setIsDeleting(true);
    try {
      const data = await deleteManagedRole(deletingRole.id);
      const nextRoles = normalizeManagedRoles(data.items);
      setRoles(nextRoles);
      applySelectedRole(nextRoles.find((role) => role.id === selectedRoleIdRef.current) || nextRoles[0] || null);
      setDeletingRole(null);
      toast.success("角色已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除角色失败");
    } finally {
      setIsDeleting(false);
    }
  };

  const setUserUpdating = (userId: string, pending: boolean) => {
    setUpdatingUserIds((current) => {
      const next = new Set(current);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const handleUserRoleChange = async (user: ManagedUser, targetRoleId: string) => {
    const roleId = String(targetRoleId || "").trim();
    if (!roleId || roleId === (user.role_id || "")) return;
    setUserUpdating(user.id, true);
    try {
      const data = await updateManagedUser(user.id, { role_id: roleId });
      setUsers(Array.isArray(data.items) ? data.items : []);
      const rolesData = await fetchManagedRoles();
      setRoles(normalizeManagedRoles(rolesData.items));
      toast.success("用户等级已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新用户等级失败");
    } finally {
      setUserUpdating(user.id, false);
    }
  };

  const handleUserSubscriptionAdjust = async (user: ManagedUser) => {
    const targetUserId = String(editingSubscriptionUserId || "").trim() || user.id;
    setUserUpdating(user.id, true);
    try {
      const payload: {
        mode: "set" | "extend" | "clear";
        tier?: "monthly" | "quarterly" | "yearly";
        expire_at?: string;
        extend_days?: number;
      } = { mode: subscriptionAdjustMode };
      if (subscriptionAdjustMode !== "clear") {
        payload.tier = subscriptionAdjustTier;
      }
      if (subscriptionAdjustMode === "set" && subscriptionAdjustExpireAt.trim()) {
        payload.expire_at = subscriptionAdjustExpireAt.trim();
      }
      if (subscriptionAdjustMode === "extend") {
        const extendDays = Number(subscriptionExtendDays.trim());
        if (!Number.isFinite(extendDays) || extendDays <= 0) {
          toast.error("续期天数必须大于 0");
          return;
        }
        payload.extend_days = Math.round(extendDays);
      }
      await adjustManagedUserSubscription(targetUserId, payload);
      await loadRoleMembers();
      toast.success("套餐有效期已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "套餐更新失败");
    } finally {
      setUserUpdating(user.id, false);
    }
  };

  const roleCountText = isLoading ? "角色加载中" : `角色 ${filteredRoles.length} / ${roles.length}`;

  return (
    <section className="flex flex-col gap-5">
      <PageHeader
        eyebrow="RBAC"
        title="角色权限"
        actions={(
          <>
            <Button variant="outline" onClick={() => void loadRBAC()} disabled={isLoading} className="h-10 rounded-lg">
              <RefreshCw className={cn("size-4", isLoading ? "animate-spin" : "")} />
              刷新
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} disabled={isLoading} className="h-10 rounded-lg">
              <Plus className="size-4" />
              创建角色
            </Button>
            <Button onClick={() => void handleSave()} disabled={!selectedRole || !isDirty || isSaving || isLoading} className="h-10 rounded-lg">
              {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              保存
            </Button>
          </>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-stone-100 px-5 py-4">
              <div className="mb-3 flex items-center justify-between text-sm text-stone-500">
                <span>{roleCountText}</span>
                <ShieldCheck className="size-4" />
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索角色名称或描述" className="h-10 rounded-lg pl-9" />
              </div>
            </div>
            <div className="max-h-[calc(100vh-18rem)] min-h-[360px] overflow-y-auto">
              {isLoading ? <div className="flex min-h-[320px] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div> : null}
              {!isLoading && filteredRoles.length === 0 ? <div className="px-5 py-12 text-center text-sm text-stone-500">暂无角色</div> : null}
              {!isLoading ? filteredRoles.map((role) => {
                const active = role.id === selectedRoleId;
                const userCount = roleMemberStats.counts.get(role.id) || 0;
                const preview = roleMemberStats.previews.get(role.id) || "暂无";
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={cn("block w-full border-b border-stone-100 px-5 py-4 text-left transition hover:bg-stone-50", active ? "bg-[#edf4ff]" : "")}
                    onClick={() => applySelectedRole(role)}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-stone-900">{role.name}</div>
                        <code className="mt-1 block truncate font-mono text-xs text-stone-500">{role.id}</code>
                      </div>
                      {role.builtin ? <Badge variant="secondary" className="shrink-0 rounded-md">内置</Badge> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{permissionCountLabel(role)}</span>
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{userCount} 用户</span>
                    </div>
                    <div className="mt-2 text-xs text-stone-500">成员：{preview}</div>
                  </button>
                );
              }) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col gap-4 border-b border-stone-100 px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <ShieldCheck className="size-5 shrink-0 text-[#1456f0]" />
                    <h2 className="truncate text-base font-semibold text-stone-900">{isLoading ? "加载中" : selectedRole?.name || "未选择角色"}</h2>
                  </div>
                  <code className="mt-1 block truncate font-mono text-xs text-stone-500">{selectedRole?.id || "-"}</code>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isDirty ? "warning" : "secondary"} className="w-fit rounded-md">{isDirty ? "未保存" : "已同步"}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg border-rose-200 px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    disabled={!selectedRole || Boolean(selectedRole.builtin) || Boolean(roleMembers.length)}
                    onClick={() => selectedRole ? setDeletingRole(selectedRole) : null}
                  >
                    <Trash2 className="size-4" />
                    删除
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
                <Input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="角色名称" disabled={!selectedRole || isLoading} className="h-10 rounded-lg" />
                <Input value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} placeholder="角色描述" disabled={!selectedRole || isLoading} className="h-10 rounded-lg" />
              </div>
            </div>

            <div className="border-b border-stone-100 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-900">当前角色成员与等级管理</h3>
                <Badge variant="secondary" className="rounded-md">{isLoading ? "-" : roleMembers.length} 用户</Badge>
              </div>
              {selectedRole ? (
                isMembersLoading ? (
                  <div className="flex min-h-[160px] items-center justify-center">
                    <LoaderCircle className="size-5 animate-spin text-stone-400" />
                  </div>
                ) : roleMembers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr className="border-b border-stone-100 text-left text-stone-500">
                          <th className="px-2 py-2 font-medium">用户</th>
                          <th className="px-2 py-2 font-medium">注册邮箱</th>
                          <th className="px-2 py-2 font-medium">当前套餐</th>
                          <th className="px-2 py-2 font-medium">剩余天数</th>
                          <th className="px-2 py-2 font-medium">到期时间</th>
                          <th className="px-2 py-2 font-medium">当前等级</th>
                          <th className="px-2 py-2 font-medium">调整等级</th>
                          <th className="px-2 py-2 font-medium">管理</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roleMembers.map((user) => {
                          const pending = updatingUserIds.has(user.id);
                          return (
                            <tr key={user.id} className="border-b border-stone-100/70">
                              <td className="px-2 py-2">
                                <div className="font-medium text-stone-900">{managedUserDisplayName(user, duplicatedUserNames)}</div>
                                <code className="mt-1 block font-mono text-[11px] text-stone-500">{user.id}</code>
                              </td>
                              <td className="px-2 py-2">{displayEmail(user.email)}</td>
                              <td className="px-2 py-2">
                                {user.subscription_active ? <Badge variant="secondary" className="rounded-md">{subscriptionTierLabel(user.subscription_tier)}</Badge> : <span className="text-stone-400">-</span>}
                              </td>
                              <td className="px-2 py-2">{subscriptionRemainingLabel(user)}</td>
                              <td className="whitespace-nowrap px-2 py-2 text-xs text-stone-500">{user.subscription_active ? formatDateTime(user.subscription_expire_at) : "-"}</td>
                              <td className="px-2 py-2"><Badge variant="secondary" className="rounded-md">{user.role_name || "普通用户"}</Badge></td>
                              <td className="px-2 py-2">
                                <Select value={String(user.role_id || "")} onValueChange={(value) => { void handleUserRoleChange(user, value); }} disabled={pending}>
                                  <SelectTrigger className="h-9 w-[220px] rounded-lg"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-2 py-2">{pending ? <LoaderCircle className="size-4 animate-spin text-stone-400" /> : <span className="text-xs text-stone-500">可升/可降</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-6 text-sm text-stone-500">当前角色下暂无用户。</div>
                )
              ) : (
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-6 text-sm text-stone-500">请先选择左侧角色。</div>
              )}
            </div>

            <div className="border-b border-stone-100 px-5 py-4">
              <div className="mb-3 text-sm font-semibold text-stone-900">管理员手动调整套餐有效期</div>
              <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                <Select value={editingSubscriptionUserId} onValueChange={setEditingSubscriptionUserId}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="选择用户" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleMembers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {managedUserDisplayName(user, duplicatedUserNames)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={subscriptionAdjustMode} onValueChange={(value) => setSubscriptionAdjustMode(value as "set" | "extend" | "clear")}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="set">设置套餐与到期时间</SelectItem>
                    <SelectItem value="extend">按天续期</SelectItem>
                    <SelectItem value="clear">清空套餐</SelectItem>
                  </SelectContent>
                </Select>
                {subscriptionAdjustMode !== "clear" ? (
                  <Select value={subscriptionAdjustTier} onValueChange={(value) => setSubscriptionAdjustTier(value as "monthly" | "quarterly" | "yearly")}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">包月</SelectItem>
                      <SelectItem value="quarterly">包季</SelectItem>
                      <SelectItem value="yearly">包年</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-10 rounded-lg border border-stone-200 bg-stone-50" />
                )}
                {subscriptionAdjustMode === "set" ? (
                  <Input type="datetime-local" value={subscriptionAdjustExpireAt} onChange={(event) => setSubscriptionAdjustExpireAt(event.target.value)} className="h-10 rounded-lg" />
                ) : subscriptionAdjustMode === "extend" ? (
                  <Input value={subscriptionExtendDays} onChange={(event) => setSubscriptionExtendDays(event.target.value)} placeholder="续期天数" className="h-10 rounded-lg" />
                ) : (
                  <div className="h-10 rounded-lg border border-stone-200 bg-stone-50" />
                )}
                <Button
                  className="h-10 rounded-lg px-4"
                  disabled={!editingSubscriptionUserId || isMembersLoading}
                  onClick={() => {
                    const user = roleMembers.find((item) => item.id === editingSubscriptionUserId);
                    if (user) {
                      void handleUserSubscriptionAdjust(user);
                    }
                  }}
                >
                  <Save className="size-4" />
                  保存
                </Button>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="mb-3 text-sm font-semibold text-stone-900">权限配置</div>
              <PermissionEditor
                menus={catalog.menus}
                apis={catalog.apis}
                selectedMenuPaths={selectedMenuPaths}
                selectedApiPermissions={selectedApiPermissions}
                onMenuPathsChange={setSelectedMenuPaths}
                onApiPermissionsChange={setSelectedApiPermissions}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>创建角色</DialogTitle>
            <DialogDescription className="text-sm leading-6">创建一个新的用户权限角色。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="角色名称" className="h-11 rounded-xl" />
            <Input value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} placeholder="角色描述（可选）" className="h-11 rounded-xl" />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" className="h-10 rounded-xl px-5" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>取消</Button>
            <Button type="button" className="h-10 rounded-xl px-5" onClick={() => void handleCreate()} disabled={isCreating}>
              {isCreating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingRole)} onOpenChange={(open) => (!open ? setDeletingRole(null) : null)}>
        <DialogContent className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>删除角色</DialogTitle>
            <DialogDescription className="text-sm leading-6">删除后无法恢复，且该角色不能再分配给用户。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" className="h-10 rounded-xl px-5" onClick={() => setDeletingRole(null)} disabled={isDeleting}>取消</Button>
            <Button type="button" className="h-10 rounded-xl bg-rose-600 px-5 text-white hover:bg-rose-700" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function RBACPage() {
  const { isCheckingAuth, session } = useAuthGuard(["admin"]);
  if (isCheckingAuth || !session || session.role !== "admin") {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }
  return <RBACContent />;
}

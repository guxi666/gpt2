"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  createManagedRole,
  deleteManagedRole,
  fetchManagedRoles,
  fetchPermissionCatalog,
  type ApiPermission,
  type ManagedRole,
  type PermissionMenu,
  updateManagedRole,
} from "@/lib/api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => String(item || "").trim()).filter(Boolean)));
}

export default function RBACPage() {
  const { isCheckingAuth, session } = useAuthGuard(["admin"]);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [menus, setMenus] = useState<PermissionMenu[]>([]);
  const [apis, setApis] = useState<ApiPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const load = async () => {
    const [rolesData, catalogData] = await Promise.all([
      fetchManagedRoles(),
      fetchPermissionCatalog(),
    ]);
    const nextRoles = Array.isArray(rolesData.items) ? rolesData.items : [];
    setRoles(nextRoles);
    setMenus(Array.isArray(catalogData.menus) ? catalogData.menus : []);
    setApis(Array.isArray(catalogData.apis) ? catalogData.apis : []);
    if (!selectedRoleId) {
      setSelectedRoleId(nextRoles[0]?.id || "");
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load();
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "加载角色权限失败");
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

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  if (isCheckingAuth || !session || isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><LoaderCircle className="size-5 animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="角色权限" description="现在已经能直接编辑角色的菜单集合和 API 权限集合，先做成最小可用版。" />
      <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
        <CardHeader><CardTitle>创建角色</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr,1fr,140px]">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="角色名称" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="角色说明" className="h-10 rounded-xl border-stone-200 bg-white" />
          <Button
            className="h-10 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
            onClick={async () => {
              try {
                const data = await createManagedRole({
                  name,
                  description,
                  menu_paths: [],
                  api_permissions: [],
                });
                const nextRoles = Array.isArray(data.items) ? data.items : [];
                setRoles(nextRoles);
                setSelectedRoleId(nextRoles.find((item) => item.name === name)?.id || nextRoles[0]?.id || "");
                setName("");
                setDescription("");
                toast.success("角色已创建");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "创建角色失败");
              }
            }}
          >
            创建
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader><CardTitle>角色列表</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selectedRoleId === role.id
                    ? "border-stone-950 bg-stone-950 text-white"
                    : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                }`}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <div className="font-medium">{role.name}</div>
                <div className={`mt-1 text-xs ${selectedRoleId === role.id ? "text-white/80" : "text-stone-500"}`}>
                  {role.description || "无说明"}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{selectedRole?.name || "角色详情"}</CardTitle>
            <div className="flex gap-2">
              {selectedRole && !selectedRole.builtin ? (
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={async () => {
                    try {
                      const data = await deleteManagedRole(selectedRole.id);
                      const nextRoles = Array.isArray(data.items) ? data.items : [];
                      setRoles(nextRoles);
                      setSelectedRoleId(nextRoles[0]?.id || "");
                      toast.success("角色已删除");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "删除角色失败");
                    }
                  }}
                >
                  删除
                </Button>
              ) : null}
              {selectedRole ? (
                <Button
                  className="h-9 rounded-xl bg-stone-950 text-white hover:bg-stone-800"
                  onClick={async () => {
                    try {
                      const data = await updateManagedRole(selectedRole.id, {
                        name: selectedRole.name,
                        description: selectedRole.description || "",
                        menu_paths: uniqueStrings(selectedRole.menu_paths || []),
                        api_permissions: uniqueStrings(selectedRole.api_permissions || []),
                      });
                      setRoles(Array.isArray(data.items) ? data.items : []);
                      toast.success("角色已保存");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "保存角色失败");
                    }
                  }}
                >
                  保存
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedRole ? (
              <div className="text-sm text-stone-500">请选择一个角色</div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={selectedRole.name}
                    onChange={(event) => setRoles((current) => current.map((role) => role.id === selectedRole.id ? { ...role, name: event.target.value } : role))}
                    placeholder="角色名称"
                    className="h-10 rounded-xl border-stone-200 bg-white"
                  />
                  <Input
                    value={selectedRole.description || ""}
                    onChange={(event) => setRoles((current) => current.map((role) => role.id === selectedRole.id ? { ...role, description: event.target.value } : role))}
                    placeholder="角色说明"
                    className="h-10 rounded-xl border-stone-200 bg-white"
                  />
                </div>

                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-3 text-sm font-medium text-stone-800">菜单权限</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {menus.map((item) => {
                      const checked = (selectedRole.menu_paths || []).includes(item.path);
                      return (
                        <label key={item.id} className="flex items-center gap-3 text-sm text-stone-700">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              setRoles((current) => current.map((role) => {
                                if (role.id !== selectedRole.id) return role;
                                const menu_paths = new Set(role.menu_paths || []);
                                if (nextChecked) menu_paths.add(item.path);
                                else menu_paths.delete(item.path);
                                return { ...role, menu_paths: Array.from(menu_paths) };
                              }));
                            }}
                          />
                          <span>{item.label}</span>
                          <span className="text-xs text-stone-400">{item.path}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-3 text-sm font-medium text-stone-800">API 权限</div>
                  <div className="grid gap-3">
                    {apis.map((item) => {
                      const checked = (selectedRole.api_permissions || []).includes(item.key);
                      return (
                        <label key={item.key} className="flex items-center gap-3 text-sm text-stone-700">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              setRoles((current) => current.map((role) => {
                                if (role.id !== selectedRole.id) return role;
                                const api_permissions = new Set(role.api_permissions || []);
                                if (nextChecked) api_permissions.add(item.key);
                                else api_permissions.delete(item.key);
                                return { ...role, api_permissions: Array.from(api_permissions) };
                              }));
                            }}
                          />
                          <span className="font-medium">{item.label}</span>
                          <span className="text-xs text-stone-400">{item.method} {item.path}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

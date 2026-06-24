"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import webConfig from "@/constants/common-env";
import { fetchThirdPartyApps, type ThirdPartyAppsSettings } from "@/lib/api";
import { getValidatedAuthSession } from "@/lib/auth-session";
import { useAppMeta } from "@/lib/use-app-meta";
import { cn } from "@/lib/utils";
import {
  canAccessPath,
  clearStoredAuthSession,
  getDefaultRouteForSession,
  type StoredAuthSession,
} from "@/store/auth";

const adminNavItems = [
  { href: "/image", label: "创作台" },
  { href: "/wallet", label: "钱包充值" },
  { href: "/agency", label: "代理加盟" },
  { href: "/accounts", label: "账号池管理" },
  { href: "/register", label: "注册机" },
  { href: "/image-manager", label: "图片库" },
  { href: "/users", label: "用户管理" },
  { href: "/rbac", label: "角色权限" },
  { href: "/logs", label: "日志管理" },
  { href: "/settings", label: "设置" },
];

const userNavItems = [
  { href: "/image", label: "创作台" },
  { href: "/wallet", label: "钱包充值" },
  { href: "/subscription", label: "订阅套餐" },
  { href: "/agency", label: "代理加盟" },
  { href: "/image-manager", label: "图片库" },
  { href: "/profile", label: "个人资料" },
];

function buildThirdPartyHref(appUrl: string, baseUrl: string, apiKey: string) {
  const url = appUrl.trim();
  try {
    const target = new URL(url);
    target.searchParams.set("apiKey", apiKey);
    target.searchParams.set("baseUrl", baseUrl);
    return target.toString();
  } catch {
    return `${url}${url.includes("?") ? "&" : "?"}apiKey=${encodeURIComponent(apiKey)}&baseUrl=${encodeURIComponent(baseUrl)}`;
  }
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<StoredAuthSession | null | undefined>(undefined);
  const [thirdPartyApps, setThirdPartyApps] = useState<ThirdPartyAppsSettings | null>(null);
  const [isCanvasDialogOpen, setIsCanvasDialogOpen] = useState(false);
  const appMeta = useAppMeta();

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (pathname === "/login") {
        if (active) {
          setSession(null);
        }
        return;
      }
      const storedSession = await getValidatedAuthSession();
      if (active) {
        setSession(storedSession);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!session) {
      setThirdPartyApps(null);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const data = await fetchThirdPartyApps();
        if (active) {
          setThirdPartyApps(data.third_party_apps);
        }
      } catch {
        if (active) {
          setThirdPartyApps(null);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [session]);

  const handleLogout = async () => {
    await clearStoredAuthSession();
    router.replace("/login");
  };

  if (pathname === "/login" || session === undefined || !session) {
    return null;
  }

  const navItems =
    session.role === "admin"
      ? adminNavItems
      : userNavItems.filter((item) => {
        if (item.href === "/subscription" && !appMeta.subscription_enabled) {
          return false;
        }
        if (item.href === "/agency" && !appMeta.agency_enabled) {
          return false;
        }
        return canAccessPath(session, item.href);
      });

  const roleLabel = session.role === "admin" ? "管理员" : "普通用户";
  const displayName = session.name.trim() || roleLabel;
  const baseUrl = webConfig.apiUrl.replace(/\/$/, "") || window.location.origin;
  const canvas = thirdPartyApps?.infinite_canvas;
  const canvasHref =
    canvas?.enabled && canvas.url.trim()
      ? buildThirdPartyHref(canvas.url, baseUrl, session.key)
      : "";

  return (
    <>
      <header className="rounded-[28px] border border-white/85 bg-white/92 px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet>
              <SheetTrigger className="inline-flex size-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-50 sm:hidden">
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>{appMeta.project_name || "GPT生图站"}</SheetTitle>
                  <div className="text-xs text-stone-500">{roleLabel} · {displayName}</div>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-1">
                  {canvasHref ? (
                    <SheetClose asChild>
                      <button
                        type="button"
                        onClick={() => setIsCanvasDialogOpen(true)}
                        className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-950"
                      >
                        无限画布
                      </button>
                    </SheetClose>
                  ) : null}
                  {navItems.map((item) => (
                    <SheetClose asChild key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          isActivePath(pathname, item.href)
                            ? "bg-stone-950 text-white"
                            : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                        )}
                      >
                        {item.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
                <SheetFooter>
                  <Button variant="outline" className="rounded-xl" onClick={() => void handleLogout()}>
                    退出
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Link
              href={getDefaultRouteForSession(session)}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-50"
            >
              {appMeta.top_left_logo_url || appMeta.site_logo_url ? (
                <img
                  src={appMeta.top_left_logo_url || appMeta.site_logo_url}
                  alt=""
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-7 items-center justify-center rounded-full bg-stone-950 text-white text-xs font-bold">
                  GPT
                </span>
              )}
              <span className="hidden sm:inline">{appMeta.app_title || "GPT生图站"}</span>
            </Link>
          </div>

          <nav className="hide-scrollbar hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-2 sm:flex">
            {canvasHref ? (
              <button
                type="button"
                onClick={() => setIsCanvasDialogOpen(true)}
                className="rounded-full px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-950"
              >
                无限画布
              </button>
            ) : null}
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  isActivePath(pathname, item.href)
                    ? "bg-stone-950 text-white"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <HeaderActions className="hidden sm:flex" />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
              onClick={() => router.push(session.role === "admin" ? "/users" : "/profile")}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-white">
                {(displayName || "U").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden md:inline">{roleLabel} · {displayName}</span>
              <ChevronDown className="size-4 text-stone-400" />
            </button>
            <Button variant="outline" className="hidden rounded-full sm:inline-flex" onClick={() => void handleLogout()}>
              退出
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={isCanvasDialogOpen} onOpenChange={setIsCanvasDialogOpen}>
        <DialogContent showCloseButton={false} className="rounded-2xl p-6">
          <DialogHeader className="gap-2">
            <DialogTitle>跳转到第三方应用</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              这个入口会自动带上当前站点地址和会话密钥，用于填充第三方应用的连接信息。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-28 overflow-auto break-all rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs leading-5 text-stone-700">
            {canvasHref}
          </div>
          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-xl">
                取消
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="rounded-xl bg-stone-950 text-white hover:bg-stone-800"
              onClick={() => {
                if (canvasHref) {
                  window.open(canvasHref, "_blank", "noopener,noreferrer");
                }
                setIsCanvasDialogOpen(false);
              }}
            >
              继续跳转
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchAuthProviders,
  login,
  loginWithPassword,
  registerEmailAccount,
  sendRegisterCode,
} from "@/lib/api";
import { useAppMeta } from "@/lib/use-app-meta";
import { useRedirectIfAuthenticated } from "@/lib/use-auth-guard";
import { getDefaultRouteForSession, setStoredAuthSession } from "@/store/auth";

type LoginMode = "key" | "password" | "register";

type AuthProviders = {
  registration?: { enabled: boolean };
  allowed_email_domains?: string[];
};

export default function LoginPage() {
  const router = useRouter();
  const appMeta = useAppMeta();
  const { isCheckingAuth } = useRedirectIfAuthenticated();

  const [mode, setMode] = useState<LoginMode>("password");
  const [authKey, setAuthKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  useEffect(() => {
    let active = true;
    const loadProviders = async () => {
      try {
        const data = await fetchAuthProviders();
        if (active) {
          setProviders(data);
        }
      } catch {
        if (active) {
          setProviders(null);
        }
      }
    };
    void loadProviders();
    return () => {
      active = false;
    };
  }, []);

  const completeLogin = async (data: {
    key?: string;
    role: "admin" | "user";
    role_id?: string;
    role_name?: string;
    subject_id: string;
    name: string;
    menu_paths?: string[];
    api_permissions?: string[];
  }, fallbackKey: string) => {
    const session = {
      key: String(data.key || fallbackKey).trim(),
      role: data.role,
      roleId: String(data.role_id || "").trim(),
      roleName: String(data.role_name || "").trim(),
      subjectId: data.subject_id,
      name: data.name,
      menuPaths: Array.isArray(data.menu_paths) ? data.menu_paths : [],
      apiPermissions: Array.isArray(data.api_permissions) ? data.api_permissions : [],
    };
    await setStoredAuthSession(session);
    router.replace(getDefaultRouteForSession(session));
  };

  const handleLogin = async () => {
    setIsSubmitting(true);
    try {
      if (mode === "key") {
        const normalizedAuthKey = authKey.trim();
        if (!normalizedAuthKey) {
          throw new Error("请输入密钥");
        }
        const data = await login(normalizedAuthKey);
        await completeLogin(data, normalizedAuthKey);
        return;
      }

      if (!email.trim() || !password.trim()) {
        throw new Error(mode === "register" ? "请完整填写注册信息" : "请输入账号或邮箱和密码");
      }

      if (mode === "password") {
        const data = await loginWithPassword({ email: email.trim(), password });
        await completeLogin(data, String(data.key || ""));
        return;
      }

      if (!registerCode.trim()) {
        throw new Error("请输入邮箱验证码");
      }
      const data = await registerEmailAccount(
        email.trim(),
        password,
        registerCode.trim(),
        registerName.trim(),
      );
      await completeLogin(data, String(data.key || ""));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendCode = async () => {
    setIsSendingCode(true);
    try {
      if (!email.trim()) {
        throw new Error("请先输入邮箱");
      }
      await sendRegisterCode(email.trim());
      toast.success("验证码已发送");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送验证码失败");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleLogin();
  };

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  const allowedDomains = providers?.allowed_email_domains || [];
  const sharedLogo = appMeta.top_left_logo_url || appMeta.site_logo_url || "";
  const brandTitle = appMeta.app_title || appMeta.project_name || "GPT生图站";
  const projectTitle = appMeta.project_name || brandTitle;
  const loginHeroImage =
    appMeta.login_hero_image_url ||
    "https://img.fw45.com/images/2026/05/13/1778631918_55e0eba1fe0100683c92fabbbfd61acf.png";

  return (
    <div className="relative grid min-h-[calc(100vh-1rem)] w-full place-items-center overflow-hidden px-4 py-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.94),_rgba(245,239,231,0.97)_42%,_rgba(240,235,227,1)_100%)]" />
      <HeaderActions className="fixed top-4 right-4 z-10" />

      <Card className="relative z-10 w-full max-w-[930px] overflow-hidden rounded-[34px] border-white/85 bg-white/95 shadow-[0_30px_120px_rgba(15,23,42,0.10)]">
        <CardContent className="grid p-0 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={handleSubmit} className="space-y-8 p-8 sm:p-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-white shadow-[0_8px_20px_rgba(15,23,42,0.10)]">
                  {sharedLogo ? (
                    <img src={sharedLogo} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <LockKeyhole className="size-5 text-stone-700" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xl font-semibold text-stone-900">{brandTitle}</div>
                  <div className="text-xs uppercase tracking-[0.28em] text-stone-400">Control Center</div>
                </div>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-sky-700">
                <ShieldCheck className="size-4" />
                Secure Access
              </div>

              <div className="space-y-2">
                <h1 className="text-5xl font-semibold tracking-tight text-stone-950">欢迎回来</h1>
                <p className="text-sm leading-7 text-stone-500">
                  继续访问账号管理、代理、订阅和图片生成控制台。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-stone-200 bg-white p-1 shadow-inner">
              <Button
                type="button"
                variant={mode === "password" || mode === "register" ? "default" : "ghost"}
                className="rounded-xl"
                onClick={() => setMode("password")}
              >
                密码登录
              </Button>
              <Button
                type="button"
                variant={mode === "key" ? "default" : "ghost"}
                className="rounded-xl"
                onClick={() => setMode("key")}
              >
                密钥登录
              </Button>
            </div>

            {mode === "key" ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">专用密钥</label>
                  <Input
                    type="password"
                    value={authKey}
                    onChange={(event) => setAuthKey(event.target.value)}
                    placeholder="请输入密钥"
                    className="h-14 rounded-2xl border-stone-200 bg-white px-5 text-base"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">账号 / 邮箱</label>
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin 或 name@company.com"
                    className="h-14 rounded-2xl border-stone-200 bg-white px-5 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">密码</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入密码"
                    className="h-14 rounded-2xl border-stone-200 bg-white px-5 text-base"
                  />
                </div>

                {mode === "register" ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-700">显示名称</label>
                      <Input
                        value={registerName}
                        onChange={(event) => setRegisterName(event.target.value)}
                        placeholder="可选"
                        className="h-14 rounded-2xl border-stone-200 bg-white px-5 text-base"
                      />
                    </div>
                    <div className="grid grid-cols-[1fr,150px] gap-3">
                      <Input
                        value={registerCode}
                        onChange={(event) => setRegisterCode(event.target.value)}
                        placeholder="邮箱验证码"
                        className="h-14 rounded-2xl border-stone-200 bg-white px-5 text-base"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-14 rounded-2xl"
                        disabled={isSendingCode}
                        onClick={() => void handleSendCode()}
                      >
                        {isSendingCode ? <LoaderCircle className="size-4 animate-spin" /> : "发送验证码"}
                      </Button>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-6 text-stone-500">
                      <div className="flex items-center gap-2 font-medium text-stone-700">
                        <ShieldCheck className="size-4" />
                        仅支持以下邮箱后缀注册
                      </div>
                      <div className="mt-2 break-words">{allowedDomains.join("、")}</div>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            <Button
              type="submit"
              className="h-14 w-full rounded-2xl bg-stone-950 text-base text-white hover:bg-stone-800"
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {mode === "register" ? "注册并登录" : "登录控制台"}
            </Button>

            <div className="space-y-4 text-center text-sm">
              {mode !== "register" ? (
                <button
                  type="button"
                  className="font-medium text-stone-600 transition hover:text-stone-950"
                  onClick={() => setMode("register")}
                >
                  没有账号，去邮箱注册
                </button>
              ) : (
                <button
                  type="button"
                  className="font-medium text-stone-600 transition hover:text-stone-950"
                  onClick={() => setMode("password")}
                >
                  已有账号，返回密码登录
                </button>
              )}
              <div>
                <button
                  type="button"
                  className="text-stone-500 transition hover:text-stone-900"
                  onClick={() => toast("暂未开放自助找回密码，请联系管理员重置")}
                >
                  找回密码
                </button>
              </div>
            </div>
          </form>

          <div
            className="hidden min-h-[720px] border-l border-stone-100 bg-cover bg-center bg-no-repeat lg:block"
            style={{ backgroundImage: `url(${loginHeroImage})` }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoaderCircle, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { HeaderActions } from "@/components/header-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchAuthProviders, login, loginWithPassword, registerEmailAccount, sendRegisterCode } from "@/lib/api";
import { useAppMeta } from "@/lib/use-app-meta";
import { useRedirectIfAuthenticated } from "@/lib/use-auth-guard";
import { getDefaultRouteForSession, setStoredAuthSession } from "@/store/auth";

type LoginMode = "key" | "password" | "register";

export default function LoginPage() {
  const router = useRouter();
  const appMeta = useAppMeta();
  const { isCheckingAuth } = useRedirectIfAuthenticated();
  const [mode, setMode] = useState<LoginMode>("key");
  const [authKey, setAuthKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [providers, setProviders] = useState<{
    registration?: { enabled: boolean };
    allowed_email_domains?: string[];
  } | null>(null);

  useMemo(() => {
    void fetchAuthProviders().then(setProviders).catch(() => setProviders(null));
    return null;
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
      } else if (mode === "password") {
        if (!email.trim() || !password.trim()) {
          throw new Error("请输入邮箱和密码");
        }
        const data = await loginWithPassword({ email: email.trim(), password });
        await completeLogin(data, String(data.key || ""));
      } else {
        if (!email.trim() || !password.trim() || !registerCode.trim()) {
          throw new Error("请完整填写注册信息");
        }
        const data = await registerEmailAccount(email.trim(), password, registerCode.trim(), registerName.trim());
        await completeLogin(data, String(data.key || ""));
      }
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

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }

  const allowedDomains = providers?.allowed_email_domains || [];
  const projectTitle = appMeta.project_name || "GPT生图站";
  const brandTitle = appMeta.app_title || projectTitle;

  return (
    <div className="grid min-h-[calc(100vh-1rem)] w-full place-items-center px-4 py-6">
      <HeaderActions className="fixed top-4 right-4 z-10" />
      <div className="grid w-full max-w-[980px] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden rounded-[34px] border border-white/70 bg-[linear-gradient(160deg,rgba(17,24,39,0.96),rgba(41,37,36,0.9))] p-8 text-white shadow-[0_30px_120px_rgba(15,23,42,0.24)] lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm">
              <Sparkles className="size-4" />
              AI 图像工作台
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight">{projectTitle}</h1>
              <p className="max-w-[34ch] text-sm leading-7 text-white/70">
                密钥登录适合管理员和接口调用，邮箱登录适合普通用户。登录后可继续使用生图、充值、代理和套餐能力。
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-white/75">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              注册邮箱可限制后缀，减少垃圾账号和异常来源。
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              品牌名称和 logo 会跟随后台配置动态同步。
            </div>
          </div>
        </div>

        <Card className="w-full rounded-[30px] border-white/80 bg-white/95 shadow-[0_28px_90px_rgba(28,25,23,0.10)]">
          <CardContent className="space-y-7 p-6 sm:p-8">
            <div className="space-y-4 text-center">
              <div className="mx-auto inline-flex size-16 items-center justify-center rounded-[20px] bg-stone-950 text-white shadow-sm">
                {appMeta.top_left_logo_url ? (
                  <img src={appMeta.top_left_logo_url} alt="" className="size-9 rounded-full object-cover" />
                ) : mode === "key" ? (
                  <LockKeyhole className="size-5" />
                ) : (
                  <Mail className="size-5" />
                )}
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium uppercase tracking-[0.22em] text-stone-400">Login</div>
                <h2 className="text-3xl font-semibold tracking-tight text-stone-950">{brandTitle}</h2>
                <p className="text-sm leading-6 text-stone-500">继续使用账号管理、代理、订阅和图片生成功能。</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-stone-100 p-1">
              <Button variant={mode === "key" ? "default" : "ghost"} className="rounded-xl" onClick={() => setMode("key")}>密钥登录</Button>
              <Button variant={mode === "password" ? "default" : "ghost"} className="rounded-xl" onClick={() => setMode("password")}>邮箱登录</Button>
              <Button variant={mode === "register" ? "default" : "ghost"} className="rounded-xl" onClick={() => setMode("register")} disabled={providers?.registration?.enabled === false}>邮箱注册</Button>
            </div>

            {mode === "key" ? (
              <div className="space-y-3">
                <Input
                  type="password"
                  value={authKey}
                  onChange={(event) => setAuthKey(event.target.value)}
                  placeholder="请输入密钥"
                  className="h-13 rounded-2xl border-stone-200 bg-white px-4"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="邮箱" className="h-13 rounded-2xl border-stone-200 bg-white px-4" />
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码" className="h-13 rounded-2xl border-stone-200 bg-white px-4" />
                {mode === "register" ? (
                  <>
                    <Input value={registerName} onChange={(event) => setRegisterName(event.target.value)} placeholder="显示名称（可选）" className="h-13 rounded-2xl border-stone-200 bg-white px-4" />
                    <div className="grid grid-cols-[1fr,140px] gap-3">
                      <Input value={registerCode} onChange={(event) => setRegisterCode(event.target.value)} placeholder="邮箱验证码" className="h-13 rounded-2xl border-stone-200 bg-white px-4" />
                      <Button variant="outline" className="h-13 rounded-2xl" disabled={isSendingCode} onClick={() => void handleSendCode()}>
                        {isSendingCode ? <LoaderCircle className="size-4 animate-spin" /> : "发送验证码"}
                      </Button>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-6 text-stone-500">
                      <div className="flex items-center gap-2 font-medium text-stone-700">
                        <ShieldCheck className="size-4" />
                        仅支持以下邮箱后缀注册
                      </div>
                      <div className="mt-2 break-words">
                        {allowedDomains.join("、")}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            <Button
              className="h-13 w-full rounded-2xl bg-stone-950 text-white hover:bg-stone-800"
              onClick={() => void handleLogin()}
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {mode === "register" ? "注册并登录" : "登录"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

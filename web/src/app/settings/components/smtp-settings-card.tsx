"use client";

import { LoaderCircle, Mail, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { useSettingsStore } from "../store";

export function SMTPSettingsCard() {
  const config = useSettingsStore((state) => state.config);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const saveConfig = useSettingsStore((state) => state.saveConfig);
  const setConfigField = useSettingsStore((state) => state.setConfigField);

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="size-4" />
          邮件发信配置
        </CardTitle>
        <Button
          className="h-9 rounded-xl bg-stone-950 px-4 text-white hover:bg-stone-800"
          onClick={() => void saveConfig()}
          disabled={isSavingConfig}
        >
          {isSavingConfig ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          保存
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <Checkbox
              checked={Boolean(config?.email_smtp_enabled)}
              onCheckedChange={(checked) => setConfigField("email_smtp_enabled", Boolean(checked))}
            />
            启用 SMTP 发信
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <Checkbox
              checked={Boolean(config?.email_smtp_use_ssl ?? true)}
              onCheckedChange={(checked) => setConfigField("email_smtp_use_ssl", Boolean(checked))}
            />
            使用 SSL（QQ 邮箱建议开启）
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            value={String(config?.email_smtp_host || "")}
            onChange={(event) => setConfigField("email_smtp_host", event.target.value)}
            placeholder="SMTP 主机"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
          <Input
            value={String(config?.email_smtp_port || "")}
            onChange={(event) => setConfigField("email_smtp_port", event.target.value)}
            placeholder="SMTP 端口"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
          <Input
            value={String(config?.email_smtp_username || "")}
            onChange={(event) => setConfigField("email_smtp_username", event.target.value)}
            placeholder="发信账号"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
          <Input
            value={String(config?.email_smtp_auth_code || "")}
            onChange={(event) => setConfigField("email_smtp_auth_code", event.target.value)}
            placeholder="授权码"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
          <Input
            value={String(config?.email_smtp_from_email || "")}
            onChange={(event) => setConfigField("email_smtp_from_email", event.target.value)}
            placeholder="发件邮箱"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
          <Input
            value={String(config?.email_smtp_from_name || "")}
            onChange={(event) => setConfigField("email_smtp_from_name", event.target.value)}
            placeholder="发件名称"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
        </div>
      </CardContent>
    </Card>
  );
}

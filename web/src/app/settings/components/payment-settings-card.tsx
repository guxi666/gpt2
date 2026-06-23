"use client";

import { CreditCard, LoaderCircle, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { useSettingsStore } from "../store";

export function PaymentSettingsCard() {
  const config = useSettingsStore((state) => state.config);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const saveConfig = useSettingsStore((state) => state.saveConfig);
  const setConfigField = useSettingsStore((state) => state.setConfigField);

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="size-4" />
          支付设置
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
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <label className="flex items-center gap-3 text-sm text-stone-700">
            <Checkbox
              checked={Boolean(config?.yipay_enabled)}
              onCheckedChange={(checked) => setConfigField("yipay_enabled", Boolean(checked))}
            />
            启用易支付
          </label>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              value={String(config?.yipay_pid || "")}
              onChange={(event) => setConfigField("yipay_pid", event.target.value)}
              placeholder="商户 PID"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <Input
              value={String(config?.yipay_key || "")}
              onChange={(event) => setConfigField("yipay_key", event.target.value)}
              placeholder="商户密钥"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <Input
              value={String(config?.yipay_submit_url || "")}
              onChange={(event) => setConfigField("yipay_submit_url", event.target.value)}
              placeholder="提交地址，例如 https://pay.example.com/submit.php"
              className="h-10 rounded-xl border-stone-200 bg-white md:col-span-2"
            />
            <Input
              value={String(config?.yipay_notify_url || "")}
              onChange={(event) => setConfigField("yipay_notify_url", event.target.value)}
              placeholder="异步回调地址"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <Input
              value={String(config?.yipay_return_url || "")}
              onChange={(event) => setConfigField("yipay_return_url", event.target.value)}
              placeholder="同步返回地址"
              className="h-10 rounded-xl border-stone-200 bg-white"
            />
            <Input
              value={String(config?.yipay_site_name || "")}
              onChange={(event) => setConfigField("yipay_site_name", event.target.value)}
              placeholder="站点名称"
              className="h-10 rounded-xl border-stone-200 bg-white md:col-span-2"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <label className="flex items-center gap-3 text-sm text-stone-700">
              <Checkbox
                checked={Boolean(config?.paypal_enabled)}
                onCheckedChange={(checked) => setConfigField("paypal_enabled", Boolean(checked))}
              />
              启用 PayPal
            </label>
            <Input
              value={String(config?.paypal_checkout_url || "")}
              onChange={(event) => setConfigField("paypal_checkout_url", event.target.value)}
              placeholder="PayPal 收款地址"
              className="mt-4 h-10 rounded-xl border-stone-200 bg-white"
            />
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <label className="flex items-center gap-3 text-sm text-stone-700">
              <Checkbox
                checked={Boolean(config?.usdt_enabled)}
                onCheckedChange={(checked) => setConfigField("usdt_enabled", Boolean(checked))}
              />
              启用 USDT
            </label>
            <div className="mt-4 grid gap-4">
              <Input
                value={String(config?.usdt_network || "")}
                onChange={(event) => setConfigField("usdt_network", event.target.value)}
                placeholder="网络，例如 TRC20"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
              <Input
                value={String(config?.usdt_address || "")}
                onChange={(event) => setConfigField("usdt_address", event.target.value)}
                placeholder="收款地址"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
              <Input
                value={String(config?.usdt_payment_url || "")}
                onChange={(event) => setConfigField("usdt_payment_url", event.target.value)}
                placeholder="支付说明页面地址（可选）"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

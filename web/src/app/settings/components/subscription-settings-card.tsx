"use client";

import { Gem, LoaderCircle, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useSettingsStore } from "../store";

export function SubscriptionSettingsCard() {
  const config = useSettingsStore((state) => state.config);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const saveConfig = useSettingsStore((state) => state.saveConfig);
  const setConfigField = useSettingsStore((state) => state.setConfigField);

  const rows = [
    ["monthly", "包月套餐"],
    ["quarterly", "包季套餐"],
    ["yearly", "包年套餐"],
  ] as const;

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gem className="size-4" />
          订阅套餐
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
        <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
          <Checkbox
            checked={Boolean(config?.subscription_enabled ?? true)}
            onCheckedChange={(checked) => setConfigField("subscription_enabled", Boolean(checked))}
          />
          启用订阅套餐
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            value={String(config?.subscription_heading || "")}
            onChange={(event) => setConfigField("subscription_heading", event.target.value)}
            placeholder="页头标题"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
          <Input
            value={String(config?.subscription_subheading || "")}
            onChange={(event) => setConfigField("subscription_subheading", event.target.value)}
            placeholder="页头副标题"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
          <Input
            value={String(config?.subscription_safety_text || "")}
            onChange={(event) => setConfigField("subscription_safety_text", event.target.value)}
            placeholder="安全提示文案"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
          <Input
            value={String(config?.subscription_agent_hint || "")}
            onChange={(event) => setConfigField("subscription_agent_hint", event.target.value)}
            placeholder="代理提示文案"
            className="h-10 rounded-xl border-stone-200 bg-white"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {rows.map(([key, label]) => (
            <div key={key} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="mb-3 text-sm font-medium text-stone-800">{label}</div>
              <div className="space-y-3">
                <Input
                  value={String(config?.[`subscription_${key}_name`] || "")}
                  onChange={(event) => setConfigField(`subscription_${key}_name`, event.target.value)}
                  placeholder="名称"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={String(config?.[`subscription_${key}_price_cents`] || "")}
                  onChange={(event) => setConfigField(`subscription_${key}_price_cents`, event.target.value)}
                  placeholder="价格（分）"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={String(config?.[`subscription_${key}_badge`] || "")}
                  onChange={(event) => setConfigField(`subscription_${key}_badge`, event.target.value)}
                  placeholder="徽标文案"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={String(config?.[`subscription_${key}_price_note`] || "")}
                  onChange={(event) => setConfigField(`subscription_${key}_price_note`, event.target.value)}
                  placeholder="价格备注"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Textarea
                  value={String(config?.[`subscription_${key}_features`] || "")}
                  onChange={(event) => setConfigField(`subscription_${key}_features`, event.target.value)}
                  placeholder="功能点，每行一条"
                  className="min-h-28 rounded-xl border-stone-200 bg-white text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

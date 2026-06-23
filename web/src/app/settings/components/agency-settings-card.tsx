"use client";

import { Crown, LoaderCircle, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useSettingsStore } from "../store";

export function AgencySettingsCard() {
  const config = useSettingsStore((state) => state.config);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const saveConfig = useSettingsStore((state) => state.saveConfig);
  const setConfigField = useSettingsStore((state) => state.setConfigField);

  const rows = [
    ["basic", "基础代理"],
    ["pro", "进阶代理"],
    ["premium", "旗舰代理"],
  ] as const;

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="size-4" />
          代理加盟
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
            checked={Boolean(config?.agency_enabled ?? true)}
            onCheckedChange={(checked) => setConfigField("agency_enabled", Boolean(checked))}
          />
          启用代理加盟
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          {rows.map(([key, label]) => (
            <div key={key} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="mb-3 text-sm font-medium text-stone-800">{label}</div>
              <div className="space-y-3">
                <Input
                  value={String(config?.[`agency_tier_${key}_cents`] || "")}
                  onChange={(event) => setConfigField(`agency_tier_${key}_cents`, event.target.value)}
                  placeholder="开通价格（分）"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={String(config?.[`agency_tier_${key}_commission_bp`] || "")}
                  onChange={(event) => setConfigField(`agency_tier_${key}_commission_bp`, event.target.value)}
                  placeholder="佣金比例 BP"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
                <Input
                  value={String(config?.[`agency_tier_${key}_discount_bp`] || "")}
                  onChange={(event) => setConfigField(`agency_tier_${key}_discount_bp`, event.target.value)}
                  placeholder="用户折扣 BP"
                  className="h-10 rounded-xl border-stone-200 bg-white"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <label className="flex items-center gap-3 text-sm text-stone-700">
              <Checkbox
                checked={Boolean(config?.agency_material_qr_enabled ?? true)}
                onCheckedChange={(checked) => setConfigField("agency_material_qr_enabled", Boolean(checked))}
              />
              推广素材启用二维码叠加
            </label>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input
                value={String(config?.agency_material_qr_x_percent || "")}
                onChange={(event) => setConfigField("agency_material_qr_x_percent", event.target.value)}
                placeholder="二维码 X 百分比"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
              <Input
                value={String(config?.agency_material_qr_y_percent || "")}
                onChange={(event) => setConfigField("agency_material_qr_y_percent", event.target.value)}
                placeholder="二维码 Y 百分比"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
              <Input
                value={String(config?.agency_material_qr_size_percent || "")}
                onChange={(event) => setConfigField("agency_material_qr_size_percent", event.target.value)}
                placeholder="二维码尺寸百分比"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
              <Input
                value={String(config?.agency_material_qr_logo_percent || "")}
                onChange={(event) => setConfigField("agency_material_qr_logo_percent", event.target.value)}
                placeholder="Logo 百分比"
                className="h-10 rounded-xl border-stone-200 bg-white"
              />
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="text-sm font-medium text-stone-800">推广素材 JSON</div>
            <Textarea
              value={JSON.stringify(config?.agency_materials || [], null, 2)}
              onChange={(event) => {
                try {
                  setConfigField("agency_materials", JSON.parse(event.target.value || "[]"));
                } catch {
                  setConfigField("agency_materials", config?.agency_materials || []);
                }
              }}
              className="mt-4 min-h-44 rounded-xl border-stone-200 bg-white font-mono text-xs"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

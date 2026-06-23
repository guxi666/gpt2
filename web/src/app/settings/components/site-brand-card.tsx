"use client";

import { LoaderCircle, Palette, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useSettingsStore } from "../store";

export function SiteBrandCard() {
  const config = useSettingsStore((state) => state.config);
  const isSavingConfig = useSettingsStore((state) => state.isSavingConfig);
  const saveConfig = useSettingsStore((state) => state.saveConfig);
  const setConfigField = useSettingsStore((state) => state.setConfigField);

  return (
    <Card className="rounded-2xl border-white/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="size-4" />
          站点品牌
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
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Input
          value={String(config?.brand_top_left_name || "")}
          onChange={(event) => setConfigField("brand_top_left_name", event.target.value)}
          placeholder="左上角名称"
          className="h-10 rounded-xl border-stone-200 bg-white"
        />
        <Input
          value={String(config?.brand_site_name || "")}
          onChange={(event) => setConfigField("brand_site_name", event.target.value)}
          placeholder="站点名称"
          className="h-10 rounded-xl border-stone-200 bg-white"
        />
        <Input
          value={String(config?.brand_top_left_logo_url || "")}
          onChange={(event) => setConfigField("brand_top_left_logo_url", event.target.value)}
          placeholder="左上角 Logo URL"
          className="h-10 rounded-xl border-stone-200 bg-white"
        />
        <Input
          value={String(config?.brand_site_logo_url || "")}
          onChange={(event) => setConfigField("brand_site_logo_url", event.target.value)}
          placeholder="站点图标 URL"
          className="h-10 rounded-xl border-stone-200 bg-white"
        />
        <Input
          value={String(config?.brand_login_hero_image_url || "")}
          onChange={(event) => setConfigField("brand_login_hero_image_url", event.target.value)}
          placeholder="登录页右侧背景图 URL"
          className="h-10 rounded-xl border-stone-200 bg-white md:col-span-2"
        />
      </CardContent>
    </Card>
  );
}

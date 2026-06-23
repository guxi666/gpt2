"use client";

import { useEffect, useState } from "react";

import { fetchAppMeta, type AppMeta } from "@/lib/api";

const defaultAppMeta: AppMeta = {
  app_title: "GPT生图站",
  project_name: "GPT生图站",
  top_left_logo_url: "",
  site_logo_url: "",
  agency_enabled: true,
  subscription_enabled: true,
};

export function useAppMeta() {
  const [appMeta, setAppMeta] = useState<AppMeta>(defaultAppMeta);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchAppMeta();
        if (active) {
          setAppMeta({
            ...defaultAppMeta,
            ...data,
          });
        }
      } catch {
        if (active) {
          setAppMeta(defaultAppMeta);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return appMeta;
}

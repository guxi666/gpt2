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

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.title = appMeta.project_name || defaultAppMeta.project_name;
    const href = appMeta.site_logo_url || appMeta.top_left_logo_url || "";
    if (!href) {
      return;
    }
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [appMeta]);

  return appMeta;
}

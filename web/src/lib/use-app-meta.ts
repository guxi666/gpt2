"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchAppMeta, type AppMeta } from "@/lib/api";

const defaultAppMeta: AppMeta = {
  app_title: "GPT生图站",
  project_name: "GPT生图站",
  top_left_logo_url: "",
  site_logo_url: "",
  login_hero_image_url: "https://img.fw45.com/images/2026/05/13/1778631918_55e0eba1fe0100683c92fabbbfd61acf.png",
  agency_enabled: false,
  subscription_enabled: false,
};

export function useAppMeta() {
  const [appMeta, setAppMeta] = useState<AppMeta>(defaultAppMeta);
  const pathname = usePathname();

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
    let iconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!iconLink) {
      iconLink = document.createElement("link");
      iconLink.rel = "icon";
      document.head.appendChild(iconLink);
    }
    iconLink.href = href;
    let shortcutIconLink = document.querySelector("link[rel='shortcut icon']") as HTMLLinkElement | null;
    if (!shortcutIconLink) {
      shortcutIconLink = document.createElement("link");
      shortcutIconLink.rel = "shortcut icon";
      document.head.appendChild(shortcutIconLink);
    }
    shortcutIconLink.href = href;
  }, [appMeta, pathname]);

  return appMeta;
}

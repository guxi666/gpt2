"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchAppMeta, type AppMeta } from "@/lib/api";

const DEFAULT_LOGIN_HERO_IMAGE =
  "https://img.fw45.com/images/2026/05/13/1778631918_55e0eba1fe0100683c92fabbbfd61acf.png";

const defaultAppMeta: AppMeta = {
  app_title: "GPT生图站",
  project_name: "GPT生图站",
  top_left_logo_url: "",
  site_logo_url: "",
  login_hero_image_url: DEFAULT_LOGIN_HERO_IMAGE,
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
        if (!active) {
          return;
        }
        setAppMeta({
          ...defaultAppMeta,
          ...data,
        });
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

    const href = appMeta.site_logo_url || appMeta.top_left_logo_url || "/favicon.ico";
    const iconLinks = Array.from(document.querySelectorAll("link[rel*='icon']")) as HTMLLinkElement[];

    if (iconLinks.length === 0) {
      const iconLink = document.createElement("link");
      iconLink.rel = "icon";
      iconLink.href = href;
      document.head.appendChild(iconLink);

      const shortcutIconLink = document.createElement("link");
      shortcutIconLink.rel = "shortcut icon";
      shortcutIconLink.href = href;
      document.head.appendChild(shortcutIconLink);
      return;
    }

    for (const iconLink of iconLinks) {
      iconLink.href = href;
    }
  }, [appMeta, pathname]);

  return appMeta;
}

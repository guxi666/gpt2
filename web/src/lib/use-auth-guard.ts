"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getValidatedAuthSession } from "@/lib/auth-session";
import {
  canAccessPath,
  getDefaultRouteForSession,
  getStoredAuthSession,
  type AuthRole,
  type StoredAuthSession,
} from "@/store/auth";

type UseAuthGuardResult = {
  isCheckingAuth: boolean;
  session: StoredAuthSession | null;
};

export function useAuthGuard(allowedRoles?: AuthRole[], requiredPath?: string): UseAuthGuardResult {
  const router = useRouter();
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const allowedRolesKey = (allowedRoles || []).join(",");

  useEffect(() => {
    let active = true;

    const load = async () => {
      const roleList = allowedRolesKey ? (allowedRolesKey.split(",") as AuthRole[]) : [];
      const cachedSession = await getStoredAuthSession();
      if (!active) {
        return;
      }

      if (!cachedSession) {
        setSession(null);
        setIsCheckingAuth(false);
        router.replace("/login");
        return;
      }

      setSession(cachedSession);
      setIsCheckingAuth(false);

      if (roleList.length > 0 && !roleList.includes(cachedSession.role)) {
        router.replace(getDefaultRouteForSession(cachedSession));
        return;
      }

      if (requiredPath && !canAccessPath(cachedSession, requiredPath)) {
        router.replace(getDefaultRouteForSession(cachedSession));
        return;
      }

      const storedSession = await getValidatedAuthSession();
      if (!active) {
        return;
      }

      if (!storedSession) {
        setSession(null);
        setIsCheckingAuth(false);
        router.replace("/login");
        return;
      }

      if (roleList.length > 0 && !roleList.includes(storedSession.role)) {
        setSession(storedSession);
        setIsCheckingAuth(false);
        router.replace(getDefaultRouteForSession(storedSession));
        return;
      }

      if (requiredPath && !canAccessPath(storedSession, requiredPath)) {
        setSession(storedSession);
        setIsCheckingAuth(false);
        router.replace(getDefaultRouteForSession(storedSession));
        return;
      }

      setSession(storedSession);
    };

    void load();
    return () => {
      active = false;
    };
  }, [allowedRolesKey, requiredPath, router]);

  return { isCheckingAuth, session };
}

export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const storedSession = await getValidatedAuthSession();
      if (!active) {
        return;
      }

      if (storedSession) {
        router.replace(getDefaultRouteForSession(storedSession));
        return;
      }

      setIsCheckingAuth(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  return { isCheckingAuth };
}

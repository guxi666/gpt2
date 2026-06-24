"use client";

import { login } from "@/lib/api";
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
  type StoredAuthSession,
} from "@/store/auth";

export async function getValidatedAuthSession(): Promise<StoredAuthSession | null> {
  const storedSession = await getStoredAuthSession();
  if (!storedSession) {
    return null;
  }

  try {
    const data = await login(storedSession.key);
    const nextSession: StoredAuthSession = {
      key: storedSession.key,
      role: data.role,
      roleId: String(data.role_id || "").trim(),
      roleName: String(data.role_name || "").trim(),
      subjectId: data.subject_id,
      name: data.name,
      username: String(data.username || "").trim(),
      email: String(data.email || "").trim(),
      menuPaths: Array.isArray(data.menu_paths) ? data.menu_paths : [],
      apiPermissions: Array.isArray(data.api_permissions) ? data.api_permissions : [],
    };
    await setStoredAuthSession(nextSession);
    return nextSession;
  } catch {
    await clearStoredAuthSession();
    return null;
  }
}

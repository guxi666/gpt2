from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timezone
from threading import Lock
from typing import Literal

from services.config import config
from services.role_service import DEFAULT_ROLE_ID, role_service
from services.storage.base import StorageBackend

AuthRole = Literal["admin", "user"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class AuthService:
    def __init__(self, storage: StorageBackend):
        self.storage = storage
        self._lock = Lock()
        self._items = self._load()
        self._last_used_flush_at: dict[str, datetime] = {}

    @staticmethod
    def _clean(value: object) -> str:
        return str(value or "").strip()

    @staticmethod
    def _default_name(role: object) -> str:
        return "管理员密钥" if str(role or "").strip().lower() == "admin" else "普通用户"

    @staticmethod
    def _normalize_string_list(value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        seen: set[str] = set()
        items: list[str] = []
        for raw in value:
            text = str(raw or "").strip()
            if not text or text in seen:
                continue
            seen.add(text)
            items.append(text)
        return items

    def _normalize_item(self, raw: object) -> dict[str, object] | None:
        if not isinstance(raw, dict):
            return None
        role = self._clean(raw.get("role")).lower()
        if role not in {"admin", "user"}:
            return None
        key_hash = self._clean(raw.get("key_hash"))
        if not key_hash:
            return None
        item_id = self._clean(raw.get("id")) or uuid.uuid4().hex[:12]
        role_id = self._clean(raw.get("role_id")) or (DEFAULT_ROLE_ID if role == "user" else "")
        normalized = {
            "id": item_id,
            "name": self._clean(raw.get("name")) or self._default_name(role),
            "username": self._clean(raw.get("username")),
            "role": role,
            "role_id": role_id,
            "role_name": self._clean(raw.get("role_name")),
            "menu_paths": self._normalize_string_list(raw.get("menu_paths")),
            "api_permissions": self._normalize_string_list(raw.get("api_permissions")),
            "provider": self._clean(raw.get("provider")) or ("system" if role == "admin" else "local"),
            "key_hash": key_hash,
            "enabled": bool(raw.get("enabled", True)),
            "created_at": self._clean(raw.get("created_at")) or _now_iso(),
            "last_used_at": self._clean(raw.get("last_used_at")) or None,
        }
        if role == "user":
            role = role_service.get_role(role_id)
            if role is not None:
                normalized["role_name"] = str(role.get("name") or normalized["role_name"]).strip()
                normalized["menu_paths"] = role.get("menu_paths") if isinstance(role.get("menu_paths"), list) else normalized["menu_paths"]
                normalized["api_permissions"] = role.get("api_permissions") if isinstance(role.get("api_permissions"), list) else normalized["api_permissions"]
        return normalized

    def _load(self) -> list[dict[str, object]]:
        try:
            items = self.storage.load_auth_keys()
        except Exception:
            return []
        if not isinstance(items, list):
            return []
        return [normalized for item in items if (normalized := self._normalize_item(item)) is not None]

    def _save(self) -> None:
        self.storage.save_auth_keys(self._items)

    def _reload_locked(self) -> None:
        self._items = self._load()

    @staticmethod
    def _public_item(item: dict[str, object]) -> dict[str, object]:
        username = str(item.get("username") or "").strip()
        return {
            "id": item.get("id"),
            "name": item.get("name"),
            "username": username,
            "email": username if "@" in username else "",
            "role": item.get("role"),
            "role_id": item.get("role_id"),
            "role_name": item.get("role_name"),
            "menu_paths": item.get("menu_paths") if isinstance(item.get("menu_paths"), list) else [],
            "api_permissions": item.get("api_permissions") if isinstance(item.get("api_permissions"), list) else [],
            "provider": item.get("provider") or "",
            "enabled": bool(item.get("enabled", True)),
            "created_at": item.get("created_at"),
            "last_used_at": item.get("last_used_at"),
        }

    def list_keys(self, role: AuthRole | None = None) -> list[dict[str, object]]:
        with self._lock:
            self._reload_locked()
            items = [item for item in self._items if role is None or item.get("role") == role]
            return [self._public_item(item) for item in items]

    def _has_key_hash_locked(self, key_hash: str, *, exclude_id: str = "") -> bool:
        for item in self._items:
            item_id = self._clean(item.get("id"))
            if exclude_id and item_id == exclude_id:
                continue
            stored_hash = self._clean(item.get("key_hash"))
            if stored_hash and hmac.compare_digest(stored_hash, key_hash):
                return True
        return False

    def _build_key_hash_locked(self, raw_key: str, *, exclude_id: str = "") -> str:
        candidate = self._clean(raw_key)
        if not candidate:
            raise ValueError("请输入新的专用密钥")
        admin_key = self._clean(config.auth_key)
        if admin_key and hmac.compare_digest(candidate, admin_key):
            raise ValueError("这个密钥和管理员密钥冲突了，请换一个新的密钥")
        key_hash = _hash_key(candidate)
        if self._has_key_hash_locked(key_hash, exclude_id=exclude_id):
            raise ValueError("这个专用密钥已经存在，请换一个新的密钥")
        return key_hash

    def _has_name_locked(self, name: str, *, role: AuthRole | None = None, exclude_id: str = "") -> bool:
        candidate = self._clean(name)
        if not candidate:
            return False
        for item in self._items:
            item_id = self._clean(item.get("id"))
            if exclude_id and item_id == exclude_id:
                continue
            if role is not None and item.get("role") != role:
                continue
            if self._clean(item.get("name")) == candidate:
                return True
        return False

    def _build_default_name_locked(self, role: AuthRole, *, exclude_id: str = "") -> str:
        base_name = self._default_name(role)
        if not self._has_name_locked(base_name, role=role, exclude_id=exclude_id):
            return base_name
        suffix = 2
        while True:
            candidate = f"{base_name} {suffix}"
            if not self._has_name_locked(candidate, role=role, exclude_id=exclude_id):
                return candidate
            suffix += 1

    def _build_name_locked(self, name: str, *, role: AuthRole, exclude_id: str = "") -> str:
        candidate = self._clean(name)
        if not candidate:
            return self._build_default_name_locked(role, exclude_id=exclude_id)
        if self._has_name_locked(candidate, role=role, exclude_id=exclude_id):
            raise ValueError("这个名称已经在使用中了，请换一个更容易区分的名称")
        return candidate

    def create_key(
        self,
        *,
        role: AuthRole,
        name: str = "",
        username: str = "",
        role_id: str = "",
        role_name: str = "",
        menu_paths: list[str] | None = None,
        api_permissions: list[str] | None = None,
        provider: str = "",
    ) -> tuple[dict[str, object], str]:
        with self._lock:
            self._reload_locked()
            normalized_name = self._build_name_locked(name, role=role)
            while True:
                raw_key = f"sk-{secrets.token_urlsafe(24)}"
                try:
                    key_hash = self._build_key_hash_locked(raw_key)
                    break
                except ValueError:
                    continue
            item = {
                "id": uuid.uuid4().hex[:12],
                "name": normalized_name,
                "username": self._clean(username),
                "role": role,
                "role_id": self._clean(role_id) or (DEFAULT_ROLE_ID if role == "user" else ""),
                "role_name": self._clean(role_name),
                "menu_paths": self._normalize_string_list(menu_paths or []),
                "api_permissions": self._normalize_string_list(api_permissions or []),
                "provider": self._clean(provider) or ("system" if role == "admin" else "local"),
                "key_hash": key_hash,
                "enabled": True,
                "created_at": _now_iso(),
                "last_used_at": None,
            }
            normalized = self._normalize_item(item) or item
            self._items.append(normalized)
            self._save()
            return self._public_item(normalized), raw_key

    def update_key(
        self,
        key_id: str,
        updates: dict[str, object],
        *,
        role: AuthRole | None = None,
    ) -> dict[str, object] | None:
        normalized_id = self._clean(key_id)
        if not normalized_id:
            return None
        with self._lock:
            self._reload_locked()
            for index, item in enumerate(self._items):
                if item.get("id") != normalized_id:
                    continue
                if role is not None and item.get("role") != role:
                    return None
                next_item = dict(item)
                next_role = "admin" if str(next_item.get("role") or "").strip().lower() == "admin" else "user"
                if "name" in updates and updates.get("name") is not None:
                    next_item["name"] = self._build_name_locked(
                        str(updates.get("name") or ""),
                        role=next_role,
                        exclude_id=normalized_id,
                    )
                if "username" in updates and updates.get("username") is not None:
                    next_item["username"] = self._clean(updates.get("username"))
                if "enabled" in updates and updates.get("enabled") is not None:
                    next_item["enabled"] = bool(updates.get("enabled"))
                if "role_id" in updates and updates.get("role_id") is not None:
                    next_item["role_id"] = self._clean(updates.get("role_id"))
                if "role_name" in updates and updates.get("role_name") is not None:
                    next_item["role_name"] = self._clean(updates.get("role_name"))
                if "menu_paths" in updates and updates.get("menu_paths") is not None:
                    next_item["menu_paths"] = self._normalize_string_list(updates.get("menu_paths"))
                if "api_permissions" in updates and updates.get("api_permissions") is not None:
                    next_item["api_permissions"] = self._normalize_string_list(updates.get("api_permissions"))
                if "key" in updates and updates.get("key") is not None:
                    next_item["key_hash"] = self._build_key_hash_locked(str(updates.get("key") or ""), exclude_id=normalized_id)
                normalized = self._normalize_item(next_item) or next_item
                self._items[index] = normalized
                self._save()
                return self._public_item(normalized)
        return None

    def delete_key(self, key_id: str, *, role: AuthRole | None = None) -> bool:
        normalized_id = self._clean(key_id)
        if not normalized_id:
            return False
        with self._lock:
            self._reload_locked()
            before = len(self._items)
            self._items = [
                item
                for item in self._items
                if not (item.get("id") == normalized_id and (role is None or item.get("role") == role))
            ]
            if len(self._items) == before:
                return False
            self._save()
            return True

    def rotate_key(self, key_id: str, *, role: AuthRole | None = None) -> tuple[dict[str, object], str] | None:
        normalized_id = self._clean(key_id)
        if not normalized_id:
            return None
        with self._lock:
            self._reload_locked()
            for index, item in enumerate(self._items):
                if item.get("id") != normalized_id:
                    continue
                if role is not None and item.get("role") != role:
                    return None
                next_item = dict(item)
                while True:
                    raw_key = f"sk-{secrets.token_urlsafe(24)}"
                    try:
                        next_item["key_hash"] = self._build_key_hash_locked(raw_key, exclude_id=normalized_id)
                        break
                    except ValueError:
                        continue
                normalized = self._normalize_item(next_item) or next_item
                self._items[index] = normalized
                self._save()
                return self._public_item(normalized), raw_key
        return None

    def authenticate(self, raw_key: str) -> dict[str, object] | None:
        candidate = self._clean(raw_key)
        if not candidate:
            return None
        candidate_hash = _hash_key(candidate)
        with self._lock:
            for index, item in enumerate(self._items):
                if not bool(item.get("enabled", True)):
                    continue
                stored_hash = self._clean(item.get("key_hash"))
                if not stored_hash or not hmac.compare_digest(stored_hash, candidate_hash):
                    continue
                next_item = dict(item)
                now = datetime.now(timezone.utc)
                next_item["last_used_at"] = now.isoformat()
                normalized = self._normalize_item(next_item) or next_item
                self._items[index] = normalized
                item_id = self._clean(normalized.get("id"))
                last_flush_at = self._last_used_flush_at.get(item_id)
                if last_flush_at is None or (now - last_flush_at).total_seconds() >= 60:
                    try:
                        self._save()
                        self._last_used_flush_at[item_id] = now
                    except Exception:
                        pass
                return self._public_item(normalized)
        return None

    def list_managed_users(self) -> list[dict[str, object]]:
        users = self.list_keys(role="user")
        role_map = {str(item.get("id") or "").strip(): item for item in role_service.list_roles()}
        items: list[dict[str, object]] = []
        for item in users:
            role = role_map.get(self._clean(item.get("role_id"))) or {}
            items.append({
                "id": item.get("id"),
                "username": item.get("username") or "",
                "email": "",
                "name": item.get("name") or "",
                "role": "user",
                "role_id": item.get("role_id") or "",
                "role_name": item.get("role_name") or role.get("name") or "",
                "provider": item.get("provider") or "local",
                "enabled": bool(item.get("enabled", True)),
                "has_api_key": True,
                "has_session": False,
                "api_key_id": item.get("id"),
                "api_key_name": item.get("name") or "",
                "credential_count": 1,
                "created_at": item.get("created_at"),
                "last_used_at": item.get("last_used_at"),
                "menu_paths": role.get("menu_paths") if isinstance(role.get("menu_paths"), list) else [],
                "api_permissions": role.get("api_permissions") if isinstance(role.get("api_permissions"), list) else [],
            })
        return items

    def import_user(
        self,
        *,
        user_id: str,
        username: str,
        name: str,
        role_id: str,
        role_name: str,
        enabled: bool,
        provider: str,
        menu_paths: list[str],
        api_permissions: list[str],
    ) -> tuple[dict[str, object], str, bool]:
        normalized_username = self._clean(username)
        if not normalized_username:
            raise ValueError("username is required")
        normalized_id = self._clean(user_id) or uuid.uuid4().hex[:12]
        with self._lock:
            self._reload_locked()
            for index, item in enumerate(self._items):
                if self._clean(item.get("username")) != normalized_username and self._clean(item.get("id")) != normalized_id:
                    continue
                next_item = dict(item)
                next_item["id"] = normalized_id
                next_item["name"] = self._clean(name) or normalized_username
                next_item["username"] = normalized_username
                next_item["role"] = "user"
                next_item["role_id"] = self._clean(role_id) or DEFAULT_ROLE_ID
                next_item["role_name"] = self._clean(role_name)
                next_item["menu_paths"] = self._normalize_string_list(menu_paths)
                next_item["api_permissions"] = self._normalize_string_list(api_permissions)
                next_item["enabled"] = bool(enabled)
                next_item["provider"] = self._clean(provider) or "legacy_import"
                normalized = self._normalize_item(next_item) or next_item
                self._items[index] = normalized
                self._save()
                return self._public_item(normalized), "", False
            raw_key = f"sk-{secrets.token_urlsafe(24)}"
            item = {
                "id": normalized_id,
                "name": self._clean(name) or normalized_username,
                "username": normalized_username,
                "role": "user",
                "role_id": self._clean(role_id) or DEFAULT_ROLE_ID,
                "role_name": self._clean(role_name),
                "menu_paths": self._normalize_string_list(menu_paths),
                "api_permissions": self._normalize_string_list(api_permissions),
                "provider": self._clean(provider) or "legacy_import",
                "key_hash": self._build_key_hash_locked(raw_key),
                "enabled": bool(enabled),
                "created_at": _now_iso(),
                "last_used_at": None,
            }
            normalized = self._normalize_item(item) or item
            self._items.append(normalized)
            self._save()
            return self._public_item(normalized), raw_key, True


auth_service = AuthService(config.get_storage_backend())

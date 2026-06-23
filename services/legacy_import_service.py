from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from services.auth_service import auth_service
from services.commerce_service import commerce_service
from services.email_auth_service import email_auth_service
from services.role_service import DEFAULT_ROLE_ID, role_service


def _read_json(path: Path) -> Any:
    if not path.exists() or path.is_dir():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _read_legacy_documents(source: Path) -> dict[str, Any]:
    if source.is_file() and source.suffix.lower() in {".db", ".sqlite", ".sqlite3"}:
        return _read_legacy_documents_from_sqlite(source)
    candidates = [
        source / "data" / "billing.json",
        source / "billing.json",
        source / "data" / "auth_users.json",
        source / "auth_users.json",
        source / "data" / "rbac_roles.json",
        source / "rbac_roles.json",
    ]
    return {
        "billing": _read_json(source / "data" / "billing.json") or _read_json(source / "billing.json"),
        "auth_users": _read_json(source / "data" / "auth_users.json") or _read_json(source / "auth_users.json"),
        "rbac_roles": _read_json(source / "data" / "rbac_roles.json") or _read_json(source / "rbac_roles.json"),
    }


def _read_legacy_documents_from_sqlite(db_path: Path) -> dict[str, Any]:
    docs: dict[str, Any] = {"billing": None, "auth_users": None, "rbac_roles": None}
    if not db_path.exists():
        return docs
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.execute("SELECT name, data FROM json_documents")
        for name, data in cur.fetchall():
            if name == "billing.json":
                docs["billing"] = json.loads(data)
            elif name == "auth_users.json":
                docs["auth_users"] = json.loads(data)
            elif name == "rbac_roles.json":
                docs["rbac_roles"] = json.loads(data)
    except Exception:
        pass
    finally:
        con.close()
    return docs


def _map_role(role: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": str(role.get("name") or "").strip(),
        "description": str(role.get("description") or "").strip(),
        "menu_paths": role.get("menu_paths") if isinstance(role.get("menu_paths"), list) else [],
        "api_permissions": role.get("api_permissions") if isinstance(role.get("api_permissions"), list) else [],
    }


def _apply_roles(raw: Any) -> int:
    items = []
    if isinstance(raw, dict):
        items = raw.get("items") if isinstance(raw.get("items"), list) else []
    elif isinstance(raw, list):
        items = raw
    imported = 0
    current = role_service.list_roles()
    by_name = {str(item.get("name") or "").strip(): item for item in current}
    for raw_role in items:
        if not isinstance(raw_role, dict):
            continue
        payload = _map_role(raw_role)
        if not payload["name"]:
            continue
        existing = by_name.get(payload["name"])
        try:
            if existing:
                role_service.update_role(str(existing.get("id") or ""), payload)
            else:
                role_service.create_role(payload)
            imported += 1
        except Exception:
            continue
    return imported


def _apply_users(raw: Any) -> tuple[int, list[dict[str, str]]]:
    items = []
    if isinstance(raw, dict):
        items = raw.get("items") if isinstance(raw.get("items"), list) else []
    elif isinstance(raw, list):
        items = raw
    imported = 0
    created_keys: list[dict[str, str]] = []
    for raw_user in items:
        if not isinstance(raw_user, dict):
            continue
        username = str(raw_user.get("username") or raw_user.get("email") or "").strip()
        if not username:
            continue
        role_id = str(raw_user.get("role_id") or DEFAULT_ROLE_ID).strip() or DEFAULT_ROLE_ID
        role = role_service.get_role(role_id) or role_service.get_role(DEFAULT_ROLE_ID)
        role_name = str(role.get("name") or "") if isinstance(role, dict) else ""
        try:
            email_auth_service.import_legacy_user(raw_user)
            item, raw_key, created = auth_service.import_user(
                user_id=str(raw_user.get("id") or "").strip(),
                username=username,
                name=str(raw_user.get("name") or username).strip(),
                role_id=role_id,
                role_name=role_name,
                enabled=bool(raw_user.get("enabled", True)),
                provider="legacy_import",
                menu_paths=role.get("menu_paths") if isinstance(role, dict) and isinstance(role.get("menu_paths"), list) else [],
                api_permissions=role.get("api_permissions") if isinstance(role, dict) and isinstance(role.get("api_permissions"), list) else [],
            )
            imported += 1
            if created:
                created_keys.append({"id": str(item.get("id") or ""), "username": username, "key": raw_key})
        except Exception:
            continue
    return imported, created_keys


def _apply_billing(raw: Any) -> int:
    obj = raw if isinstance(raw, dict) else {}
    users = obj.get("users") if isinstance(obj.get("users"), list) else []
    imported = 0
    for raw_user in users:
        if not isinstance(raw_user, dict):
            continue
        try:
            commerce_service.import_legacy_profile(raw_user)
            imported += 1
        except Exception:
            continue
    return imported


def import_legacy(source_path: str) -> dict[str, Any]:
    source = Path(str(source_path or "").strip())
    if not source.exists():
        raise ValueError("legacy source path not found")
    documents = _read_legacy_documents(source)
    roles_imported = _apply_roles(documents.get("rbac_roles"))
    users_imported, created_keys = _apply_users(documents.get("auth_users"))
    billing_imported = _apply_billing(documents.get("billing"))
    return {
        "ok": True,
        "roles_imported": roles_imported,
        "users_imported": users_imported,
        "billing_profiles_imported": billing_imported,
        "created_keys": created_keys,
    }

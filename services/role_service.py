from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from services.config import DATA_DIR


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


DEFAULT_ROLE_ID = "default-user"


def permission_key(method: str, path: str) -> str:
    return f"{str(method or '').strip().lower()}{str(path or '').strip()}"

DEFAULT_ROLES = [
    {
        "id": DEFAULT_ROLE_ID,
        "name": "默认用户",
        "description": "基础用户角色，默认允许进入创作台、钱包、订阅、代理和个人资料页面。",
        "builtin": True,
        "menu_paths": ["/image", "/wallet", "/subscription", "/agency", "/profile"],
        "api_permissions": [
            permission_key("GET", "/v1/models"),
            permission_key("POST", "/v1/images/generations"),
            permission_key("POST", "/v1/images/edits"),
            permission_key("POST", "/v1/chat/completions"),
            permission_key("POST", "/v1/responses"),
            permission_key("POST", "/v1/messages"),
            permission_key("GET", "/api/image-tasks"),
            permission_key("POST", "/api/image-tasks/generations"),
            permission_key("POST", "/api/image-tasks/edits"),
            permission_key("POST", "/api/image-tasks/{task_id}/resume-poll"),
            permission_key("GET", "/api/wallet"),
            permission_key("POST", "/api/pay/orders"),
            permission_key("GET", "/api/pay/orders"),
            permission_key("POST", "/api/wallet/redeem"),
            permission_key("GET", "/api/agency"),
            permission_key("POST", "/api/agency/join"),
            permission_key("POST", "/api/agency/upgrade"),
            permission_key("GET", "/api/agency/commission"),
            permission_key("GET", "/api/agency/withdrawals"),
            permission_key("POST", "/api/agency/withdrawals"),
            permission_key("GET", "/api/agency/withdraw-profile"),
            permission_key("POST", "/api/agency/withdraw-profile"),
            permission_key("GET", "/api/subscriptions/plans"),
            permission_key("POST", "/api/subscriptions/orders"),
            permission_key("GET", "/api/third-party-apps"),
        ],
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
]


PERMISSION_MENUS = [
    {"id": "image", "label": "创作台", "path": "/image", "order": 1},
    {"id": "wallet", "label": "钱包充值", "path": "/wallet", "order": 2},
    {"id": "subscription", "label": "订阅套餐", "path": "/subscription", "order": 3},
    {"id": "agency", "label": "代理加盟", "path": "/agency", "order": 4},
    {"id": "profile", "label": "个人资料", "path": "/profile", "order": 5},
]


PERMISSION_APIS = [
    {"key": permission_key("GET", "/v1/models"), "method": "GET", "path": "/v1/models", "label": "查看模型列表", "group": "生图"},
    {"key": permission_key("POST", "/v1/images/generations"), "method": "POST", "path": "/v1/images/generations", "label": "文生图", "group": "生图"},
    {"key": permission_key("POST", "/v1/images/edits"), "method": "POST", "path": "/v1/images/edits", "label": "图生图", "group": "生图"},
    {"key": permission_key("POST", "/v1/chat/completions"), "method": "POST", "path": "/v1/chat/completions", "label": "图片 ChatCompletions", "group": "生图"},
    {"key": permission_key("POST", "/v1/responses"), "method": "POST", "path": "/v1/responses", "label": "图片 Responses", "group": "生图"},
    {"key": permission_key("POST", "/v1/messages"), "method": "POST", "path": "/v1/messages", "label": "图片 Messages", "group": "生图"},
    {"key": permission_key("GET", "/api/image-tasks"), "method": "GET", "path": "/api/image-tasks", "label": "查看图片任务", "group": "生图"},
    {"key": permission_key("POST", "/api/image-tasks/generations"), "method": "POST", "path": "/api/image-tasks/generations", "label": "创建文生图任务", "group": "生图"},
    {"key": permission_key("POST", "/api/image-tasks/edits"), "method": "POST", "path": "/api/image-tasks/edits", "label": "创建图生图任务", "group": "生图"},
    {"key": permission_key("POST", "/api/image-tasks/{task_id}/resume-poll"), "method": "POST", "path": "/api/image-tasks/{task_id}/resume-poll", "label": "继续轮询图片任务", "group": "生图"},
    {"key": permission_key("GET", "/api/wallet"), "method": "GET", "path": "/api/wallet", "label": "查看钱包", "group": "商业"},
    {"key": permission_key("POST", "/api/pay/orders"), "method": "POST", "path": "/api/pay/orders", "label": "创建充值订单", "group": "商业"},
    {"key": permission_key("GET", "/api/pay/orders"), "method": "GET", "path": "/api/pay/orders", "label": "查看支付订单", "group": "商业"},
    {"key": permission_key("POST", "/api/wallet/redeem"), "method": "POST", "path": "/api/wallet/redeem", "label": "兑换卡密", "group": "商业"},
    {"key": permission_key("GET", "/api/agency"), "method": "GET", "path": "/api/agency", "label": "查看代理信息", "group": "代理"},
    {"key": permission_key("POST", "/api/agency/join"), "method": "POST", "path": "/api/agency/join", "label": "创建代理订单", "group": "代理"},
    {"key": permission_key("POST", "/api/agency/upgrade"), "method": "POST", "path": "/api/agency/upgrade", "label": "升级代理", "group": "代理"},
    {"key": permission_key("GET", "/api/agency/commission"), "method": "GET", "path": "/api/agency/commission", "label": "查看代理收益", "group": "代理"},
    {"key": permission_key("GET", "/api/agency/withdrawals"), "method": "GET", "path": "/api/agency/withdrawals", "label": "查看提现申请", "group": "代理"},
    {"key": permission_key("POST", "/api/agency/withdrawals"), "method": "POST", "path": "/api/agency/withdrawals", "label": "创建提现申请", "group": "代理"},
    {"key": permission_key("GET", "/api/agency/withdraw-profile"), "method": "GET", "path": "/api/agency/withdraw-profile", "label": "查看提现资料", "group": "代理"},
    {"key": permission_key("POST", "/api/agency/withdraw-profile"), "method": "POST", "path": "/api/agency/withdraw-profile", "label": "保存提现资料", "group": "代理"},
    {"key": permission_key("GET", "/api/subscriptions/plans"), "method": "GET", "path": "/api/subscriptions/plans", "label": "查看订阅套餐", "group": "订阅"},
    {"key": permission_key("POST", "/api/subscriptions/orders"), "method": "POST", "path": "/api/subscriptions/orders", "label": "创建订阅订单", "group": "订阅"},
    {"key": permission_key("GET", "/api/third-party-apps"), "method": "GET", "path": "/api/third-party-apps", "label": "查看第三方应用入口", "group": "扩展"},
]


class RoleService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._path = DATA_DIR / "managed_roles.json"
        DATA_DIR.mkdir(parents=True, exist_ok=True)

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

    def _normalize_role(self, raw: object) -> dict[str, Any] | None:
        if not isinstance(raw, dict):
            return None
        role_id = str(raw.get("id") or "").strip() or uuid.uuid4().hex[:12]
        name = str(raw.get("name") or "").strip()
        if not name:
            return None
        return {
            "id": role_id,
            "name": name,
            "description": str(raw.get("description") or "").strip(),
            "builtin": bool(raw.get("builtin")),
            "menu_paths": self._normalize_string_list(raw.get("menu_paths")),
            "api_permissions": self._normalize_string_list(raw.get("api_permissions")),
            "created_at": str(raw.get("created_at") or _now_iso()).strip() or _now_iso(),
            "updated_at": str(raw.get("updated_at") or _now_iso()).strip() or _now_iso(),
        }

    def _load(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return [dict(item) for item in DEFAULT_ROLES]
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except Exception:
            return [dict(item) for item in DEFAULT_ROLES]
        if not isinstance(data, list):
            return [dict(item) for item in DEFAULT_ROLES]
        items = [normalized for item in data if (normalized := self._normalize_role(item)) is not None]
        default_role = dict(DEFAULT_ROLES[0])
        merged: list[dict[str, Any]] = []
        found_default = False
        for item in items:
            if str(item.get("id") or "").strip() == DEFAULT_ROLE_ID:
                found_default = True
                item["menu_paths"] = self._normalize_string_list([
                    *default_role["menu_paths"],
                    *self._normalize_string_list(item.get("menu_paths")),
                ])
                item["api_permissions"] = self._normalize_string_list([
                    *default_role["api_permissions"],
                    *self._normalize_string_list(item.get("api_permissions")),
                ])
            merged.append(item)
        if not found_default:
            merged.insert(0, default_role)
        items = merged
        return items

    def _save(self, items: list[dict[str, Any]]) -> None:
        self._path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def list_roles(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(item) for item in self._load()]

    def get_role(self, role_id: str) -> dict[str, Any] | None:
        normalized_id = str(role_id or "").strip()
        if not normalized_id:
            return None
        for item in self.list_roles():
            if str(item.get("id") or "").strip() == normalized_id:
                return item
        return None

    def create_role(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            items = self._load()
            name = str(payload.get("name") or "").strip()
            if not name:
                raise ValueError("role name is required")
            if any(str(item.get("name") or "").strip() == name for item in items):
                raise ValueError("role name already exists")
            role = self._normalize_role({
                **payload,
                "id": uuid.uuid4().hex[:12],
                "builtin": False,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            })
            if role is None:
                raise ValueError("role payload is invalid")
            items.append(role)
            self._save(items)
            return role

    def update_role(self, role_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        normalized_id = str(role_id or "").strip()
        if not normalized_id:
            raise ValueError("role id is required")
        with self._lock:
            items = self._load()
            for index, item in enumerate(items):
                if str(item.get("id") or "").strip() != normalized_id:
                    continue
                name = str(payload.get("name") or item.get("name") or "").strip()
                if not name:
                    raise ValueError("role name is required")
                for other in items:
                    if str(other.get("id") or "").strip() == normalized_id:
                        continue
                    if str(other.get("name") or "").strip() == name:
                        raise ValueError("role name already exists")
                next_item = {
                    **item,
                    "name": name,
                    "description": str(payload.get("description") if "description" in payload else item.get("description") or "").strip(),
                    "menu_paths": self._normalize_string_list(payload.get("menu_paths") if "menu_paths" in payload else item.get("menu_paths")),
                    "api_permissions": self._normalize_string_list(payload.get("api_permissions") if "api_permissions" in payload else item.get("api_permissions")),
                    "updated_at": _now_iso(),
                }
                items[index] = next_item
                self._save(items)
                return next_item
        raise ValueError("role not found")

    def delete_role(self, role_id: str) -> None:
        normalized_id = str(role_id or "").strip()
        if not normalized_id:
            raise ValueError("role id is required")
        with self._lock:
            items = self._load()
            for item in items:
                if str(item.get("id") or "").strip() == normalized_id and bool(item.get("builtin")):
                    raise ValueError("builtin role cannot be deleted")
            next_items = [item for item in items if str(item.get("id") or "").strip() != normalized_id]
            if len(next_items) == len(items):
                raise ValueError("role not found")
            self._save(next_items)

    def permission_catalog(self) -> dict[str, Any]:
        return {
            "menus": [dict(item) for item in PERMISSION_MENUS],
            "apis": [dict(item) for item in PERMISSION_APIS],
        }


def has_api_permission(role: dict[str, Any] | None, method: str, path: str) -> bool:
    if not isinstance(role, dict):
        return False
    granted = RoleService._normalize_string_list(role.get("api_permissions"))
    if permission_key(method, path) in granted:
        return True
    for item in granted:
        if "{" not in item:
            continue
        granted_method = ""
        granted_path = item
        if item.startswith(("get/", "post/", "put/", "patch/", "delete/")):
            split_index = item.find("/", 4)
            if split_index > 0:
                granted_method = item[:split_index].upper()
                granted_path = item[split_index:]
        if granted_method and granted_method != str(method or "").strip().upper():
            continue
        if _path_matches_template(granted_path, path):
            return True
    return False


def _path_matches_template(template: str, actual: str) -> bool:
    template_parts = [item for item in str(template or "").strip().split("/") if item]
    actual_parts = [item for item in str(actual or "").strip().split("/") if item]
    if len(template_parts) != len(actual_parts):
        return False
    for expected, value in zip(template_parts, actual_parts):
        if expected.startswith("{") and expected.endswith("}"):
            continue
        if expected != value:
            return False
    return True


role_service = RoleService()

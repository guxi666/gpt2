from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from threading import Lock
from typing import Any

from services.config import DATA_DIR


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


DEFAULT_ROLE_ID = "default-user"
AGENCY_BASIC_ROLE_ID = "agency-basic"
AGENCY_PRO_ROLE_ID = "agency-pro"
AGENCY_PREMIUM_ROLE_ID = "agency-premium"
SUBSCRIPTION_MONTHLY_ROLE_ID = "subscription-monthly"
SUBSCRIPTION_QUARTERLY_ROLE_ID = "subscription-quarterly"
SUBSCRIPTION_YEARLY_ROLE_ID = "subscription-yearly"


def permission_key(method: str, path: str) -> str:
    return f"{str(method or '').strip().lower()}{str(path or '').strip()}"


COMMON_USER_MENU_PATHS = ["/image", "/wallet", "/subscription", "/agency", "/image-manager", "/profile"]

COMMON_USER_API_PERMISSIONS = [
    permission_key("GET", "/v1/models"),
    permission_key("POST", "/v1/images/generations"),
    permission_key("POST", "/v1/images/edits"),
    permission_key("POST", "/v1/chat/completions"),
    permission_key("POST", "/v1/responses"),
    permission_key("POST", "/v1/messages"),
    permission_key("GET", "/api/image-tasks"),
    permission_key("GET", "/api/images"),
    permission_key("POST", "/api/images/delete"),
    permission_key("POST", "/api/images/download"),
    permission_key("GET", "/api/images/download/{image_path:path}"),
    permission_key("POST", "/api/image-tasks/generations"),
    permission_key("POST", "/api/image-tasks/edits"),
    permission_key("POST", "/api/image-tasks/{task_id}/resume-poll"),
    permission_key("GET", "/api/wallet"),
    permission_key("POST", "/api/wallet/redeem"),
    permission_key("GET", "/api/pay/orders"),
    permission_key("POST", "/api/pay/orders"),
    permission_key("GET", "/api/subscriptions/plans"),
    permission_key("POST", "/api/subscriptions/orders"),
    permission_key("GET", "/api/agency"),
    permission_key("POST", "/api/agency/join"),
    permission_key("POST", "/api/agency/upgrade"),
    permission_key("GET", "/api/agency/commission"),
    permission_key("GET", "/api/agency/withdrawals"),
    permission_key("POST", "/api/agency/withdrawals"),
    permission_key("GET", "/api/agency/withdraw-profile"),
    permission_key("POST", "/api/agency/withdraw-profile"),
    permission_key("GET", "/api/third-party-apps"),
]


def _build_default_role(
    role_id: str,
    name: str,
    description: str,
    *,
    agency_tier: str = "",
    subscription_tier: str = "",
) -> dict[str, Any]:
    return {
        "id": role_id,
        "name": name,
        "description": description,
        "builtin": True,
        "agency_tier": agency_tier,
        "subscription_tier": subscription_tier,
        "menu_paths": list(COMMON_USER_MENU_PATHS),
        "api_permissions": list(COMMON_USER_API_PERMISSIONS),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }


DEFAULT_ROLES = [
    _build_default_role(
        DEFAULT_ROLE_ID,
        "普通用户",
        "基础普通权限，包含创作台、钱包充值、代理加盟、套餐订阅和个人资料。",
    ),
    _build_default_role(
        AGENCY_BASIC_ROLE_ID,
        "代理-基础",
        "基础代理权限组，适合个人起步和轻量推广。",
        agency_tier="basic",
    ),
    _build_default_role(
        AGENCY_PRO_ROLE_ID,
        "代理-进阶",
        "进阶代理权限组，适合团队运营和渠道扩展。",
        agency_tier="pro",
    ),
    _build_default_role(
        AGENCY_PREMIUM_ROLE_ID,
        "代理-旗舰",
        "旗舰代理权限组，适合规模化业务和高阶分销。",
        agency_tier="premium",
    ),
    _build_default_role(
        SUBSCRIPTION_MONTHLY_ROLE_ID,
        "套餐-包月",
        "包月套餐权限组，套餐期内可按订阅模式使用平台。",
        subscription_tier="monthly",
    ),
    _build_default_role(
        SUBSCRIPTION_QUARTERLY_ROLE_ID,
        "套餐-包季",
        "包季套餐权限组，适合稳定持续创作。",
        subscription_tier="quarterly",
    ),
    _build_default_role(
        SUBSCRIPTION_YEARLY_ROLE_ID,
        "套餐-包年",
        "包年套餐权限组，适合长期高频使用。",
        subscription_tier="yearly",
    ),
]


PERMISSION_MENUS = [
    {"id": "image", "label": "创作台", "path": "/image", "order": 1},
    {"id": "wallet", "label": "钱包充值", "path": "/wallet", "order": 2},
    {"id": "subscription", "label": "套餐订阅", "path": "/subscription", "order": 3},
    {"id": "agency", "label": "代理加盟", "path": "/agency", "order": 4},
    {"id": "image-manager", "label": "图片库", "path": "/image-manager", "order": 5},
    {"id": "profile", "label": "个人资料", "path": "/profile", "order": 6},
]


PERMISSION_APIS = [
    {"key": permission_key("GET", "/v1/models"), "method": "GET", "path": "/v1/models", "label": "查看模型列表", "group": "普通权限"},
    {"key": permission_key("POST", "/v1/images/generations"), "method": "POST", "path": "/v1/images/generations", "label": "文生图", "group": "普通权限"},
    {"key": permission_key("POST", "/v1/images/edits"), "method": "POST", "path": "/v1/images/edits", "label": "图生图", "group": "普通权限"},
    {"key": permission_key("POST", "/v1/chat/completions"), "method": "POST", "path": "/v1/chat/completions", "label": "图片 ChatCompletions", "group": "普通权限"},
    {"key": permission_key("POST", "/v1/responses"), "method": "POST", "path": "/v1/responses", "label": "图片 Responses", "group": "普通权限"},
    {"key": permission_key("POST", "/v1/messages"), "method": "POST", "path": "/v1/messages", "label": "图片 Messages", "group": "普通权限"},
    {"key": permission_key("GET", "/api/image-tasks"), "method": "GET", "path": "/api/image-tasks", "label": "查看图片任务", "group": "普通权限"},
    {"key": permission_key("GET", "/api/images"), "method": "GET", "path": "/api/images", "label": "查看图片库", "group": "普通权限"},
    {"key": permission_key("POST", "/api/images/delete"), "method": "POST", "path": "/api/images/delete", "label": "删除自己的图片", "group": "普通权限"},
    {"key": permission_key("POST", "/api/images/download"), "method": "POST", "path": "/api/images/download", "label": "批量下载图片", "group": "普通权限"},
    {"key": permission_key("GET", "/api/images/download/{image_path:path}"), "method": "GET", "path": "/api/images/download/{image_path:path}", "label": "下载单张图片", "group": "普通权限"},
    {"key": permission_key("POST", "/api/image-tasks/generations"), "method": "POST", "path": "/api/image-tasks/generations", "label": "创建文生图任务", "group": "普通权限"},
    {"key": permission_key("POST", "/api/image-tasks/edits"), "method": "POST", "path": "/api/image-tasks/edits", "label": "创建图生图任务", "group": "普通权限"},
    {"key": permission_key("POST", "/api/image-tasks/{task_id}/resume-poll"), "method": "POST", "path": "/api/image-tasks/{task_id}/resume-poll", "label": "继续轮询任务", "group": "普通权限"},
    {"key": permission_key("GET", "/api/wallet"), "method": "GET", "path": "/api/wallet", "label": "查看钱包", "group": "普通权限"},
    {"key": permission_key("POST", "/api/wallet/redeem"), "method": "POST", "path": "/api/wallet/redeem", "label": "兑换卡密", "group": "普通权限"},
    {"key": permission_key("GET", "/api/pay/orders"), "method": "GET", "path": "/api/pay/orders", "label": "查看支付订单", "group": "普通权限"},
    {"key": permission_key("POST", "/api/pay/orders"), "method": "POST", "path": "/api/pay/orders", "label": "创建充值订单", "group": "普通权限"},
    {"key": permission_key("GET", "/api/subscriptions/plans"), "method": "GET", "path": "/api/subscriptions/plans", "label": "查看套餐列表", "group": "套餐权限"},
    {"key": permission_key("POST", "/api/subscriptions/orders"), "method": "POST", "path": "/api/subscriptions/orders", "label": "创建套餐订单", "group": "套餐权限"},
    {"key": permission_key("GET", "/api/agency"), "method": "GET", "path": "/api/agency", "label": "查看代理信息", "group": "代理权限"},
    {"key": permission_key("POST", "/api/agency/join"), "method": "POST", "path": "/api/agency/join", "label": "创建代理订单", "group": "代理权限"},
    {"key": permission_key("POST", "/api/agency/upgrade"), "method": "POST", "path": "/api/agency/upgrade", "label": "升级代理", "group": "代理权限"},
    {"key": permission_key("GET", "/api/agency/commission"), "method": "GET", "path": "/api/agency/commission", "label": "查看代理收益", "group": "代理权限"},
    {"key": permission_key("GET", "/api/agency/withdrawals"), "method": "GET", "path": "/api/agency/withdrawals", "label": "查看提现申请", "group": "代理权限"},
    {"key": permission_key("POST", "/api/agency/withdrawals"), "method": "POST", "path": "/api/agency/withdrawals", "label": "创建提现申请", "group": "代理权限"},
    {"key": permission_key("GET", "/api/agency/withdraw-profile"), "method": "GET", "path": "/api/agency/withdraw-profile", "label": "查看提现资料", "group": "代理权限"},
    {"key": permission_key("POST", "/api/agency/withdraw-profile"), "method": "POST", "path": "/api/agency/withdraw-profile", "label": "保存提现资料", "group": "代理权限"},
    {"key": permission_key("GET", "/api/third-party-apps"), "method": "GET", "path": "/api/third-party-apps", "label": "查看第三方应用入口", "group": "普通权限"},
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
            "agency_tier": str(raw.get("agency_tier") or "").strip().lower(),
            "subscription_tier": str(raw.get("subscription_tier") or "").strip().lower(),
            "menu_paths": self._normalize_string_list(raw.get("menu_paths")),
            "api_permissions": self._normalize_string_list(raw.get("api_permissions")),
            "created_at": str(raw.get("created_at") or _now_iso()).strip() or _now_iso(),
            "updated_at": str(raw.get("updated_at") or _now_iso()).strip() or _now_iso(),
        }

    def _merge_with_defaults(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        default_map = {str(item.get("id") or "").strip(): dict(item) for item in DEFAULT_ROLES}
        default_name_map = {str(item.get("name") or "").strip(): dict(item) for item in DEFAULT_ROLES}
        merged: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for item in items:
            role_id = str(item.get("id") or "").strip()
            role_name = str(item.get("name") or "").strip()
            default_role = default_map.get(role_id) or default_name_map.get(role_name)
            if default_role is not None:
                item["id"] = str(default_role.get("id") or role_id).strip() or role_id
                role_id = str(item.get("id") or "").strip()
                if role_id in seen_ids:
                    continue
                item["builtin"] = True
                item["agency_tier"] = str(item.get("agency_tier") or default_role.get("agency_tier") or "").strip().lower()
                item["subscription_tier"] = str(item.get("subscription_tier") or default_role.get("subscription_tier") or "").strip().lower()
                item["menu_paths"] = self._normalize_string_list([
                    *self._normalize_string_list(default_role.get("menu_paths")),
                    *self._normalize_string_list(item.get("menu_paths")),
                ])
                item["api_permissions"] = self._normalize_string_list([
                    *self._normalize_string_list(default_role.get("api_permissions")),
                    *self._normalize_string_list(item.get("api_permissions")),
                ])
                if not str(item.get("description") or "").strip():
                    item["description"] = str(default_role.get("description") or "").strip()
            merged.append(item)
            if role_id:
                seen_ids.add(role_id)
        for default_role in DEFAULT_ROLES:
            role_id = str(default_role.get("id") or "").strip()
            if role_id and role_id not in seen_ids:
                merged.append(dict(default_role))
        merged.sort(key=lambda item: next((idx for idx, role in enumerate(DEFAULT_ROLES) if role["id"] == item.get("id")), len(DEFAULT_ROLES) + 1))
        return merged

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
        return self._merge_with_defaults(items)

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
                "agency_tier": str(payload.get("agency_tier") or "").strip().lower(),
                "subscription_tier": str(payload.get("subscription_tier") or "").strip().lower(),
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
                    "agency_tier": str(payload.get("agency_tier") if "agency_tier" in payload else item.get("agency_tier") or "").strip().lower(),
                    "subscription_tier": str(payload.get("subscription_tier") if "subscription_tier" in payload else item.get("subscription_tier") or "").strip().lower(),
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

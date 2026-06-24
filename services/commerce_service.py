from __future__ import annotations

import copy
import hashlib
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any
from urllib.parse import urlencode

from services.config import DATA_DIR
from services.config import config


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _to_iso(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.astimezone(timezone.utc).isoformat()


def _parse_iso(value: object) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _add_months(base: datetime, months: int) -> datetime:
    year = base.year + (base.month - 1 + months) // 12
    month = (base.month - 1 + months) % 12 + 1
    day = min(base.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return base.replace(year=year, month=month, day=day)


def _sanitize_identity(identity: dict[str, Any]) -> dict[str, str]:
    return {
        "id": str(identity.get("id") or "").strip(),
        "role": str(identity.get("role") or "").strip(),
        "name": str(identity.get("name") or "").strip(),
    }


def _apply_subscription_state(profile: dict[str, Any]) -> dict[str, Any]:
    current = dict(profile)
    expire_at = _parse_iso(current.get("subscription_expire_at"))
    tier = str(current.get("subscription_tier") or "").strip()
    active = bool(expire_at and expire_at > _now() and tier)
    current["subscription_active"] = active
    current["subscription_expire_at"] = _to_iso(expire_at)
    return current


def _lookup_managed_user(user_id: str) -> dict[str, Any] | None:
    from services.auth_service import auth_service
    from services.email_auth_service import email_auth_service

    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return None
    for user in auth_service.list_managed_users():
        if str(user.get("id") or "").strip() == normalized_user_id:
            return user
    for user in email_auth_service.list_managed_users():
        if str(user.get("id") or "").strip() == normalized_user_id:
            return user
    return None


@dataclass
class YiPayConfig:
    enabled: bool
    pid: str
    key: str
    submit_url: str
    notify_url: str
    return_url: str
    site_name: str


class CommerceService:
    def __init__(self) -> None:
        self._lock = RLock()
        self._profiles_path = DATA_DIR / "commerce_profiles.json"
        self._orders_path = DATA_DIR / "commerce_orders.json"
        self._redeem_codes_path = DATA_DIR / "commerce_redeem_codes.json"
        self._withdrawals_path = DATA_DIR / "commerce_withdrawals.json"
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _load_json(path: Path, default: Any) -> Any:
        if not path.exists():
            return copy.deepcopy(default)
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return copy.deepcopy(default)

    @staticmethod
    def _save_json(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def _load_profiles(self) -> dict[str, dict[str, Any]]:
        raw = self._load_json(self._profiles_path, {})
        return raw if isinstance(raw, dict) else {}

    def _save_profiles(self, profiles: dict[str, dict[str, Any]]) -> None:
        self._save_json(self._profiles_path, profiles)

    def _load_orders(self) -> list[dict[str, Any]]:
        raw = self._load_json(self._orders_path, [])
        return raw if isinstance(raw, list) else []

    def _save_orders(self, orders: list[dict[str, Any]]) -> None:
        self._save_json(self._orders_path, orders)

    def _load_redeem_codes(self) -> list[dict[str, Any]]:
        raw = self._load_json(self._redeem_codes_path, [])
        return raw if isinstance(raw, list) else []

    def _save_redeem_codes(self, codes: list[dict[str, Any]]) -> None:
        self._save_json(self._redeem_codes_path, codes)

    def _load_withdrawals(self) -> list[dict[str, Any]]:
        raw = self._load_json(self._withdrawals_path, [])
        return raw if isinstance(raw, list) else []

    def _save_withdrawals(self, items: list[dict[str, Any]]) -> None:
        self._save_json(self._withdrawals_path, items)

    def ensure_profile(self, identity: dict[str, Any]) -> dict[str, Any]:
        subject = _sanitize_identity(identity)
        user_id = subject["id"]
        with self._lock:
            profiles = self._load_profiles()
            current = profiles.get(user_id) or {}
            profile = {
                "user_id": user_id,
                "name": subject["name"] or current.get("name") or user_id,
                "role": subject["role"] or current.get("role") or "user",
                "invite_code": str(current.get("invite_code") or self._new_invite_code()).strip(),
                "invited_by": str(current.get("invited_by") or "").strip(),
                "invited_by_email": str(current.get("invited_by_email") or "").strip(),
                "invited_count": int(current.get("invited_count") or 0),
                "invited_users": current.get("invited_users") if isinstance(current.get("invited_users"), list) else [],
                "balance_cents": int(current.get("balance_cents") or 0),
                "total_recharge_cents": int(current.get("total_recharge_cents") or 0),
                "total_consume_cents": int(current.get("total_consume_cents") or 0),
                "agency_tier": str(current.get("agency_tier") or "").strip(),
                "agency_enabled": bool(current.get("agency_enabled")),
                "agency_commission_bp": int(current.get("agency_commission_bp") or 0),
                "agency_discount_bp": int(current.get("agency_discount_bp") or 0),
                "agency_joined_at": str(current.get("agency_joined_at") or "").strip(),
                "agency_alipay_qr_code": str(current.get("agency_alipay_qr_code") or "").strip(),
                "agency_wechat_qr_code": str(current.get("agency_wechat_qr_code") or "").strip(),
                "agency_phone": str(current.get("agency_phone") or "").strip(),
                "agency_wechat_id": str(current.get("agency_wechat_id") or "").strip(),
                "subscription_tier": str(current.get("subscription_tier") or "").strip(),
                "subscription_start_at": str(current.get("subscription_start_at") or "").strip(),
                "subscription_expire_at": str(current.get("subscription_expire_at") or "").strip(),
                "subscription_active": bool(current.get("subscription_active")),
                "last_login_at": str(current.get("last_login_at") or "").strip() or _now_iso(),
                "updated_at": _now_iso(),
            }
            profile = _apply_subscription_state(profile)
            profiles[user_id] = profile
            self._save_profiles(profiles)
            return copy.deepcopy(profile)

    def ensure_profile_by_user_id(self, user_id: str) -> dict[str, Any]:
        managed_user = _lookup_managed_user(user_id)
        if managed_user is None:
            raise ValueError("user not found")
        return self.ensure_profile({
            "id": str(managed_user.get("id") or "").strip(),
            "role": str(managed_user.get("role") or "user").strip() or "user",
            "name": str(managed_user.get("name") or managed_user.get("username") or managed_user.get("email") or user_id).strip(),
        })

    def grant_signup_bonus(self, identity: dict[str, Any]) -> dict[str, Any]:
        gift_count = int(config.get().get("register_gift_image_count") or 0)
        image_price_cents = int(config.get().get("image_price_cents") or 0)
        amount_cents = max(0, gift_count) * max(0, image_price_cents)
        if amount_cents <= 0:
            return self.ensure_profile(identity)
        subject = _sanitize_identity(identity)
        with self._lock:
            profiles = self._load_profiles()
            profile = profiles.get(subject["id"]) or self.ensure_profile(identity)
            if bool(profile.get("signup_bonus_granted")):
                return copy.deepcopy(profile)
            profile["balance_cents"] = int(profile.get("balance_cents") or 0) + amount_cents
            profile["total_recharge_cents"] = int(profile.get("total_recharge_cents") or 0) + amount_cents
            profile["signup_bonus_granted"] = True
            profile["updated_at"] = _now_iso()
            profiles[subject["id"]] = profile
            self._save_profiles(profiles)
            orders = self._load_orders()
            orders.append({
                "id": secrets.token_hex(8),
                "out_trade_no": self._new_order_no(),
                "record_type": "transaction",
                "type": "signup_bonus",
                "order_kind": "signup_bonus",
                "provider": "system",
                "status": "paid",
                "user_id": subject["id"],
                "user_display": str(profile.get("name") or subject["id"]),
                "pay_type": "bonus",
                "amount_cents": amount_cents,
                "amount_yuan": f"{amount_cents / 100:.2f}",
                "balance_after_cents": int(profile.get("balance_cents") or 0),
                "note": f"register gift {gift_count} image credits",
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "paid_at": _now_iso(),
            })
            self._save_orders(orders)
            return copy.deepcopy(_apply_subscription_state(profile))

    def charge_usage(self, identity: dict[str, Any], *, usage_type: str, amount_cents: int, note: str = "") -> dict[str, Any]:
        subject = _sanitize_identity(identity)
        if subject["role"] == "admin" or amount_cents <= 0:
            return self.ensure_profile(identity)
        with self._lock:
            profiles = self._load_profiles()
            profile = _apply_subscription_state(profiles.get(subject["id"]) or self.ensure_profile(identity))
            subscription_active = bool(profile.get("subscription_active"))
            if usage_type == "image" and subscription_active:
                return copy.deepcopy(profile)
            current_balance = int(profile.get("balance_cents") or 0)
            if current_balance < amount_cents:
                raise ValueError("insufficient balance")
            profile["balance_cents"] = current_balance - amount_cents
            profile["total_consume_cents"] = int(profile.get("total_consume_cents") or 0) + amount_cents
            profile["updated_at"] = _now_iso()
            profiles[subject["id"]] = profile
            self._save_profiles(profiles)
            orders = self._load_orders()
            orders.append({
                "id": secrets.token_hex(8),
                "out_trade_no": self._new_order_no(),
                "record_type": "transaction",
                "type": f"{usage_type}_usage",
                "order_kind": f"{usage_type}_usage",
                "provider": "usage",
                "status": "paid",
                "user_id": subject["id"],
                "user_display": str(profile.get("name") or subject["id"]),
                "pay_type": "balance",
                "amount_cents": -amount_cents,
                "amount_yuan": f"{-amount_cents / 100:.2f}",
                "balance_after_cents": int(profile.get("balance_cents") or 0),
                "note": note or f"{usage_type} usage",
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "paid_at": _now_iso(),
            })
            self._save_orders(orders)
            return copy.deepcopy(_apply_subscription_state(profile))

    def get_wallet(self, identity: dict[str, Any]) -> dict[str, Any]:
        profile = self.ensure_profile(identity)
        return _apply_subscription_state(profile)

    def import_legacy_profile(self, raw_user: dict[str, Any]) -> dict[str, Any]:
        user_id = str(raw_user.get("id") or "").strip()
        if not user_id:
            raise ValueError("legacy user id is required")
        with self._lock:
            profiles = self._load_profiles()
            current = profiles.get(user_id) or {}
            profile = {
                "user_id": user_id,
                "name": str(raw_user.get("name") or raw_user.get("email") or current.get("name") or user_id).strip(),
                "role": "user",
                "invite_code": str(raw_user.get("invite_code") or current.get("invite_code") or self._new_invite_code()).strip(),
                "invited_by": str(raw_user.get("invited_by") or current.get("invited_by") or "").strip(),
                "invited_by_email": str(raw_user.get("invited_by_email") or current.get("invited_by_email") or "").strip(),
                "invited_count": int(raw_user.get("invited_count") or current.get("invited_count") or 0),
                "invited_users": raw_user.get("invited_users") if isinstance(raw_user.get("invited_users"), list) else current.get("invited_users", []),
                "balance_cents": int(raw_user.get("balance_cents") or current.get("balance_cents") or 0),
                "total_recharge_cents": int(raw_user.get("total_recharge_cents") or current.get("total_recharge_cents") or 0),
                "total_consume_cents": int(raw_user.get("total_consume_cents") or current.get("total_consume_cents") or 0),
                "agency_tier": str(raw_user.get("agency_tier") or current.get("agency_tier") or "").strip(),
                "agency_enabled": bool(raw_user.get("agency_enabled", current.get("agency_enabled", False))),
                "agency_commission_bp": int(raw_user.get("agency_commission_bp") or current.get("agency_commission_bp") or 0),
                "agency_discount_bp": int(raw_user.get("agency_discount_bp") or current.get("agency_discount_bp") or 0),
                "agency_joined_at": str(raw_user.get("agency_joined_at") or current.get("agency_joined_at") or "").strip(),
                "agency_alipay_qr_code": str(raw_user.get("agency_alipay_qr_code") or current.get("agency_alipay_qr_code") or "").strip(),
                "agency_wechat_qr_code": str(raw_user.get("agency_wechat_qr_code") or current.get("agency_wechat_qr_code") or "").strip(),
                "agency_phone": str(raw_user.get("agency_phone") or current.get("agency_phone") or "").strip(),
                "agency_wechat_id": str(raw_user.get("agency_wechat_id") or current.get("agency_wechat_id") or "").strip(),
                "subscription_tier": str(raw_user.get("subscription_tier") or current.get("subscription_tier") or "").strip(),
                "subscription_start_at": str(raw_user.get("subscription_start_at") or current.get("subscription_start_at") or "").strip(),
                "subscription_expire_at": str(raw_user.get("subscription_expire_at") or current.get("subscription_expire_at") or "").strip(),
                "subscription_active": bool(raw_user.get("subscription_active", current.get("subscription_active", False))),
                "last_login_at": str(raw_user.get("last_login_at") or current.get("last_login_at") or _now_iso()).strip() or _now_iso(),
                "updated_at": _now_iso(),
            }
            profiles[user_id] = profile
            self._save_profiles(profiles)
            return copy.deepcopy(profile)

    def import_legacy_billing(self, raw: dict[str, Any]) -> dict[str, int]:
        obj = raw if isinstance(raw, dict) else {}
        users = obj.get("users") if isinstance(obj.get("users"), list) else []
        orders = obj.get("orders") if isinstance(obj.get("orders"), list) else []
        withdrawals = obj.get("withdrawals") if isinstance(obj.get("withdrawals"), list) else []
        redeem_codes = obj.get("redeem_codes") if isinstance(obj.get("redeem_codes"), list) else []

        imported_profiles = 0
        imported_orders = 0
        imported_withdrawals = 0
        imported_codes = 0

        with self._lock:
            profiles = self._load_profiles()
            stored_orders = self._load_orders()
            stored_withdrawals = self._load_withdrawals()
            stored_codes = self._load_redeem_codes()

            profile_ids = {str(item.get("user_id") or "").strip() for item in profiles.values()}
            order_ids = {str(item.get("id") or "").strip() for item in stored_orders}
            withdrawal_ids = {str(item.get("id") or "").strip() for item in stored_withdrawals}
            code_ids = {str(item.get("code") or "").strip().upper() for item in stored_codes}

            for raw_user in users:
                if not isinstance(raw_user, dict):
                    continue
                user_id = str(raw_user.get("id") or "").strip()
                if not user_id:
                    continue
                if user_id not in profile_ids:
                    imported_profiles += 1
                profile_ids.add(user_id)
                current = profiles.get(user_id) or {}
                profiles[user_id] = {
                    "user_id": user_id,
                    "name": str(raw_user.get("name") or raw_user.get("email") or current.get("name") or user_id).strip(),
                    "role": "user",
                    "invite_code": str(raw_user.get("invite_code") or current.get("invite_code") or self._new_invite_code()).strip(),
                    "invited_by": str(raw_user.get("invited_by") or current.get("invited_by") or "").strip(),
                    "invited_by_email": str(raw_user.get("invited_by_email") or current.get("invited_by_email") or "").strip(),
                    "invited_count": int(raw_user.get("invited_count") or current.get("invited_count") or 0),
                    "invited_users": raw_user.get("invited_users") if isinstance(raw_user.get("invited_users"), list) else current.get("invited_users", []),
                    "balance_cents": int(raw_user.get("balance_cents") or current.get("balance_cents") or 0),
                    "total_recharge_cents": int(raw_user.get("total_recharge_cents") or current.get("total_recharge_cents") or 0),
                    "total_consume_cents": int(raw_user.get("total_consume_cents") or current.get("total_consume_cents") or 0),
                    "agency_tier": str(raw_user.get("agency_tier") or current.get("agency_tier") or "").strip(),
                    "agency_enabled": bool(raw_user.get("agency_enabled", current.get("agency_enabled", False))),
                    "agency_commission_bp": int(raw_user.get("agency_commission_bp") or current.get("agency_commission_bp") or 0),
                    "agency_discount_bp": int(raw_user.get("agency_discount_bp") or current.get("agency_discount_bp") or 0),
                    "agency_joined_at": str(raw_user.get("agency_joined_at") or current.get("agency_joined_at") or "").strip(),
                    "agency_alipay_qr_code": str(raw_user.get("agency_alipay_qr_code") or current.get("agency_alipay_qr_code") or "").strip(),
                    "agency_wechat_qr_code": str(raw_user.get("agency_wechat_qr_code") or current.get("agency_wechat_qr_code") or "").strip(),
                    "agency_phone": str(raw_user.get("agency_phone") or current.get("agency_phone") or "").strip(),
                    "agency_wechat_id": str(raw_user.get("agency_wechat_id") or current.get("agency_wechat_id") or "").strip(),
                    "subscription_tier": str(raw_user.get("subscription_tier") or current.get("subscription_tier") or "").strip(),
                    "subscription_start_at": str(raw_user.get("subscription_start_at") or current.get("subscription_start_at") or "").strip(),
                    "subscription_expire_at": str(raw_user.get("subscription_expire_at") or current.get("subscription_expire_at") or "").strip(),
                    "subscription_active": bool(raw_user.get("subscription_active", current.get("subscription_active", False))),
                    "last_login_at": str(raw_user.get("last_login_at") or current.get("last_login_at") or _now_iso()).strip() or _now_iso(),
                    "updated_at": _now_iso(),
                }

            for raw_order in orders:
                if not isinstance(raw_order, dict):
                    continue
                order_id = str(raw_order.get("id") or "").strip()
                if not order_id or order_id in order_ids:
                    continue
                stored_orders.append({
                    "id": order_id,
                    "record_type": "order",
                    "type": str(raw_order.get("kind") or raw_order.get("type") or "").strip(),
                    "order_kind": str(raw_order.get("kind") or raw_order.get("type") or "").strip(),
                    "provider": str(raw_order.get("provider") or "").strip(),
                    "status": str(raw_order.get("status") or "").strip().lower() or "pending",
                    "out_trade_no": str(raw_order.get("out_trade_no") or "").strip(),
                    "trade_no": str(raw_order.get("trade_no") or "").strip(),
                    "user_id": str(raw_order.get("user_id") or "").strip(),
                    "user_display": str(raw_order.get("user_email") or raw_order.get("user_id") or "").strip(),
                    "pay_type": str(raw_order.get("pay_type") or "").strip(),
                    "amount_cents": int(raw_order.get("amount_cents") or 0),
                    "amount_yuan": f"{int(raw_order.get('amount_cents') or 0) / 100:.2f}",
                    "balance_after_cents": 0,
                    "note": str(raw_order.get("note") or "").strip(),
                    "agency_tier": str(raw_order.get("agency_tier") or "").strip(),
                    "subscription_tier": str(raw_order.get("subscription_tier") or "").strip(),
                    "created_at": str(raw_order.get("created_at") or "").strip(),
                    "updated_at": str(raw_order.get("updated_at") or "").strip(),
                    "paid_at": str(raw_order.get("paid_at") or "").strip(),
                })
                order_ids.add(order_id)
                imported_orders += 1

            for raw_item in withdrawals:
                if not isinstance(raw_item, dict):
                    continue
                withdrawal_id = str(raw_item.get("id") or "").strip()
                if not withdrawal_id or withdrawal_id in withdrawal_ids:
                    continue
                stored_withdrawals.append({
                    "id": withdrawal_id,
                    "user_id": str(raw_item.get("user_id") or "").strip(),
                    "user_email": str(raw_item.get("user_email") or "").strip(),
                    "amount_cents": int(raw_item.get("amount_cents") or 0),
                    "amount_yuan": f"{int(raw_item.get('amount_cents') or 0) / 100:.2f}",
                    "alipay_qr_code": str(raw_item.get("alipay_qr_code") or "").strip(),
                    "wechat_qr_code": str(raw_item.get("wechat_qr_code") or "").strip(),
                    "phone": str(raw_item.get("phone") or "").strip(),
                    "wechat_id": str(raw_item.get("wechat_id") or "").strip(),
                    "status": str(raw_item.get("status") or "pending").strip(),
                    "admin_note": str(raw_item.get("admin_note") or "").strip(),
                    "created_at": str(raw_item.get("created_at") or "").strip(),
                    "updated_at": str(raw_item.get("updated_at") or "").strip(),
                    "processed_at": str(raw_item.get("processed_at") or "").strip(),
                })
                withdrawal_ids.add(withdrawal_id)
                imported_withdrawals += 1

            for raw_code in redeem_codes:
                if not isinstance(raw_code, dict):
                    continue
                code = str(raw_code.get("code") or "").strip().upper()
                if not code or code in code_ids:
                    continue
                stored_codes.append({
                    "code": code,
                    "amount_cents": int(raw_code.get("amount_cents") or 0),
                    "amount_yuan": f"{int(raw_code.get('amount_cents') or 0) / 100:.2f}",
                    "enabled": bool(raw_code.get("enabled", True)),
                    "created_at": str(raw_code.get("created_at") or "").strip(),
                    "updated_at": str(raw_code.get("updated_at") or "").strip(),
                    "expires_at": str(raw_code.get("expires_at") or "").strip(),
                    "used_by": str(raw_code.get("used_by") or "").strip(),
                    "used_at": str(raw_code.get("used_at") or "").strip(),
                    "note": str(raw_code.get("note") or "").strip(),
                })
                code_ids.add(code)
                imported_codes += 1

            self._save_profiles(profiles)
            self._save_orders(stored_orders)
            self._save_withdrawals(stored_withdrawals)
            self._save_redeem_codes(stored_codes)

        return {
            "profiles": imported_profiles,
            "orders": imported_orders,
            "withdrawals": imported_withdrawals,
            "redeem_codes": imported_codes,
        }

    def list_orders(self, identity: dict[str, Any], limit: int = 100) -> list[dict[str, Any]]:
        user_id = _sanitize_identity(identity)["id"]
        with self._lock:
            orders = [item for item in self._load_orders() if str(item.get("user_id") or "").strip() == user_id]
        orders.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return orders[: max(1, min(limit, 500))]

    def list_all_orders(self, limit: int = 500) -> list[dict[str, Any]]:
        with self._lock:
            orders = self._load_orders()
        orders.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return orders[: max(1, min(limit, 5000))]

    def billing_stats(self) -> dict[str, Any]:
        orders = self.list_all_orders(5000)
        now = _now()
        today_revenue_cents = 0
        total_revenue_cents = 0
        today_paid_count = 0
        total_paid_count = 0
        pending_count = 0
        failed_count = 0
        for item in orders:
            status = str(item.get("status") or "").strip().lower()
            amount_cents = int(item.get("amount_cents") or 0)
            created_at = _parse_iso(item.get("created_at"))
            is_revenue_order = str(item.get("record_type") or "").strip() == "order" and amount_cents > 0
            if status == "paid" and is_revenue_order:
                total_revenue_cents += amount_cents
                total_paid_count += 1
                if created_at and created_at.date() == now.date():
                    today_revenue_cents += amount_cents
                    today_paid_count += 1
            elif status == "pending" and str(item.get("record_type") or "").strip() == "order":
                pending_count += 1
            elif status == "failed" and str(item.get("record_type") or "").strip() == "order":
                failed_count += 1
        return {
            "today_revenue_cents": today_revenue_cents,
            "today_revenue_yuan": f"{today_revenue_cents / 100:.2f}",
            "today_paid_count": today_paid_count,
            "total_revenue_cents": total_revenue_cents,
            "total_revenue_yuan": f"{total_revenue_cents / 100:.2f}",
            "total_paid_count": total_paid_count,
            "pending_count": pending_count,
            "failed_count": failed_count,
            "record_count": len(orders),
            "updated_at": _now_iso(),
        }

    def list_profiles(self) -> list[dict[str, Any]]:
        with self._lock:
            profiles = self._load_profiles()
        items = list(profiles.values())
        items.sort(key=lambda item: str(item.get("updated_at") or ""), reverse=True)
        return [copy.deepcopy(_apply_subscription_state(item)) for item in items]

    def update_balance(
        self,
        user_id: str,
        *,
        delta_cents: int | None = None,
        balance_cents: int | None = None,
        note: str = "",
    ) -> dict[str, Any]:
        normalized_user_id = str(user_id or "").strip()
        if not normalized_user_id:
            raise ValueError("user id is required")
        with self._lock:
            profiles = self._load_profiles()
            profile = profiles.get(normalized_user_id)
            if profile is None:
                profile = self.ensure_profile_by_user_id(normalized_user_id)
                profiles = self._load_profiles()
                profile = profiles.get(normalized_user_id) or profile
            current_balance = int(profile.get("balance_cents") or 0)
            if balance_cents is not None:
                next_balance = max(0, int(balance_cents))
                delta = next_balance - current_balance
            elif delta_cents is not None:
                delta = int(delta_cents)
                next_balance = max(0, current_balance + delta)
            else:
                raise ValueError("balance change is required")
            profile["balance_cents"] = next_balance
            if delta > 0:
                profile["total_recharge_cents"] = int(profile.get("total_recharge_cents") or 0) + delta
            elif delta < 0:
                profile["total_consume_cents"] = int(profile.get("total_consume_cents") or 0) + abs(delta)
            profile["updated_at"] = _now_iso()
            profiles[normalized_user_id] = profile
            self._save_profiles(profiles)
            if delta != 0:
                orders = self._load_orders()
                orders.append({
                    "id": secrets.token_hex(8),
                    "out_trade_no": self._new_order_no(),
                    "record_type": "transaction",
                    "type": "admin_adjust",
                    "order_kind": "admin_adjust",
                    "provider": "admin_adjust",
                    "status": "paid",
                    "user_id": normalized_user_id,
                    "user_display": str(profile.get("name") or normalized_user_id),
                    "pay_type": "balance",
                    "amount_cents": delta,
                    "amount_yuan": f"{delta / 100:.2f}",
                    "balance_after_cents": next_balance,
                    "note": str(note or "").strip(),
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                    "paid_at": _now_iso(),
                })
                self._save_orders(orders)
            return copy.deepcopy(profile)

    def update_subscription(
        self,
        user_id: str,
        *,
        mode: str,
        tier: str = "",
        expire_at: str = "",
        extend_days: int = 0,
    ) -> dict[str, Any]:
        normalized_user_id = str(user_id or "").strip()
        normalized_mode = str(mode or "").strip().lower()
        normalized_tier = str(tier or "").strip().lower()
        if normalized_user_id == "":
            raise ValueError("user id is required")
        if normalized_mode not in {"set", "extend", "clear"}:
            raise ValueError("invalid subscription mode")
        with self._lock:
            profiles = self._load_profiles()
            profile = profiles.get(normalized_user_id)
            if profile is None:
                profile = self.ensure_profile_by_user_id(normalized_user_id)
                profiles = self._load_profiles()
                profile = profiles.get(normalized_user_id) or profile
            now = _now()
            if normalized_mode == "clear":
                profile["subscription_tier"] = ""
                profile["subscription_start_at"] = ""
                profile["subscription_expire_at"] = ""
                profile["subscription_active"] = False
            elif normalized_mode == "extend":
                if extend_days <= 0:
                    raise ValueError("extend_days is required")
                current_expire = _parse_iso(profile.get("subscription_expire_at")) or now
                if current_expire < now:
                    current_expire = now
                profile["subscription_expire_at"] = _to_iso(current_expire + timedelta(days=int(extend_days)))
                profile["subscription_active"] = bool(profile.get("subscription_tier"))
            else:
                if normalized_tier not in {"monthly", "quarterly", "yearly"}:
                    raise ValueError("invalid subscription tier")
                if expire_at.strip():
                    parsed_expire = _parse_iso(expire_at)
                    if parsed_expire is None:
                        raise ValueError("expire_at is invalid")
                    next_expire = parsed_expire
                else:
                    months = {"monthly": 1, "quarterly": 3, "yearly": 12}[normalized_tier]
                    next_expire = _add_months(now, months)
                profile["subscription_tier"] = normalized_tier
                profile["subscription_start_at"] = profile.get("subscription_start_at") or _now_iso()
                profile["subscription_expire_at"] = _to_iso(next_expire)
                profile["subscription_active"] = next_expire > now
            profile["updated_at"] = _now_iso()
            profiles[normalized_user_id] = profile
            self._save_profiles(profiles)
            return {
                "tier": str(profile.get("subscription_tier") or ""),
                "start_at": str(profile.get("subscription_start_at") or ""),
                "expire_at": str(profile.get("subscription_expire_at") or ""),
                "active": bool(profile.get("subscription_active")),
            }

    def redeem_code(self, identity: dict[str, Any], code: str) -> dict[str, Any]:
        normalized = str(code or "").strip()
        if not normalized:
            raise ValueError("redeem code is required")
        user_id = _sanitize_identity(identity)["id"]
        with self._lock:
            profiles = self._load_profiles()
            profile = profiles.get(user_id) or self.ensure_profile(identity)
            codes = self._load_redeem_codes()
            for item in codes:
                if str(item.get("code") or "").strip() != normalized:
                    continue
                if not bool(item.get("enabled", True)):
                    raise ValueError("redeem code is disabled")
                if str(item.get("used_by") or "").strip():
                    raise ValueError("redeem code already used")
                amount_cents = int(item.get("amount_cents") or 0)
                profile["balance_cents"] = int(profile.get("balance_cents") or 0) + amount_cents
                profile["total_recharge_cents"] = int(profile.get("total_recharge_cents") or 0) + amount_cents
                profile["updated_at"] = _now_iso()
                item["used_by"] = user_id
                item["used_at"] = _now_iso()
                profiles[user_id] = profile
                self._save_profiles(profiles)
                self._save_redeem_codes(codes)
                return copy.deepcopy(profile)
        raise ValueError("redeem code not found")

    def create_yipay_order(
        self,
        identity: dict[str, Any],
        amount_cents: int,
        pay_type: str,
        config: YiPayConfig,
        *,
        order_kind: str = "recharge",
        agency_tier: str = "",
        subscription_tier: str = "",
        note: str = "",
    ) -> dict[str, Any]:
        if not config.enabled:
            raise ValueError("YiPay is not configured")
        if not config.pid or not config.key or not config.submit_url:
            raise ValueError("YiPay configuration is incomplete")
        if amount_cents <= 0:
            raise ValueError("amount is invalid")
        identity_data = _sanitize_identity(identity)
        profile = self.ensure_profile(identity)
        out_trade_no = f"pay_{_now().strftime('%Y%m%d%H%M%S')}{secrets.token_hex(4)}"
        pay_type = (pay_type or "alipay").strip().lower() or "alipay"
        params = {
            "pid": config.pid,
            "type": pay_type,
            "out_trade_no": out_trade_no,
            "notify_url": config.notify_url,
            "return_url": config.return_url,
            "name": note or f"{config.site_name or 'chatgpt2api'} {order_kind}",
            "money": f"{amount_cents / 100:.2f}",
            "sitename": config.site_name or "chatgpt2api",
            "param": identity_data["id"],
        }
        sign = self._yipay_sign(params, config.key)
        pay_url = f"{config.submit_url.rstrip('?')}{'&' if '?' in config.submit_url else '?'}{urlencode({**params, 'sign': sign, 'sign_type': 'MD5'})}"
        order = {
            "id": secrets.token_hex(8),
            "record_type": "order",
            "type": order_kind,
            "order_kind": order_kind,
            "provider": "yipay",
            "status": "pending",
            "out_trade_no": out_trade_no,
            "user_id": identity_data["id"],
            "user_display": identity_data["name"],
            "pay_type": pay_type,
            "amount_cents": amount_cents,
            "amount_yuan": f"{amount_cents / 100:.2f}",
            "pay_url": pay_url,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "note": note,
            "agency_tier": agency_tier,
            "subscription_tier": subscription_tier,
            "balance_after_cents": int(profile.get("balance_cents") or 0),
        }
        with self._lock:
            orders = self._load_orders()
            orders.append(order)
            self._save_orders(orders)
        return order

    def handle_yipay_notify(self, values: dict[str, Any], config: YiPayConfig) -> tuple[bool, dict[str, Any] | None]:
        if not config.enabled or not config.key:
            raise ValueError("YiPay is not configured")
        form = {str(key): str(value) for key, value in values.items()}
        sign = form.pop("sign", "").strip()
        form.pop("sign_type", None)
        if not sign:
            raise ValueError("sign is required")
        expected = self._yipay_sign(form, config.key)
        if sign.lower() != expected.lower():
            raise ValueError("invalid yipay sign")
        if form.get("trade_status", "").upper() not in {"TRADE_SUCCESS", "TRADE_FINISHED"}:
            return False, None
        out_trade_no = form.get("out_trade_no", "").strip()
        if not out_trade_no:
            raise ValueError("out_trade_no is required")
        with self._lock:
            orders = self._load_orders()
            profiles = self._load_profiles()
            for index, order in enumerate(orders):
                if str(order.get("out_trade_no") or "").strip() != out_trade_no:
                    continue
                if str(order.get("status") or "").strip().lower() == "paid":
                    return True, copy.deepcopy(order)
                order = dict(order)
                order["status"] = "paid"
                order["paid_at"] = _now_iso()
                order["updated_at"] = _now_iso()
                user_id = str(order.get("user_id") or "").strip()
                profile = profiles.get(user_id) or {
                    "user_id": user_id,
                    "name": str(order.get("user_display") or user_id).strip(),
                    "role": "user",
                    "invite_code": self._new_invite_code(),
                    "balance_cents": 0,
                    "total_recharge_cents": 0,
                    "total_consume_cents": 0,
                    "agency_tier": "",
                    "agency_enabled": False,
                    "agency_commission_bp": 0,
                    "agency_discount_bp": 0,
                    "subscription_tier": "",
                    "subscription_start_at": "",
                    "subscription_expire_at": "",
                    "subscription_active": False,
                    "updated_at": _now_iso(),
                }
                kind = str(order.get("order_kind") or order.get("type") or "recharge").strip()
                amount_cents = int(order.get("amount_cents") or 0)
                if kind == "recharge":
                    profile["balance_cents"] = int(profile.get("balance_cents") or 0) + amount_cents
                    profile["total_recharge_cents"] = int(profile.get("total_recharge_cents") or 0) + amount_cents
                elif kind in {"agency_join", "agency_upgrade"}:
                    profile["agency_tier"] = str(order.get("agency_tier") or "").strip()
                    profile["agency_enabled"] = bool(profile["agency_tier"])
                    tier_key = str(profile.get("agency_tier") or "").strip()
                    if tier_key == "basic":
                        profile["agency_commission_bp"] = 3000
                        profile["agency_discount_bp"] = 500
                    elif tier_key == "pro":
                        profile["agency_commission_bp"] = 4500
                        profile["agency_discount_bp"] = 1000
                    elif tier_key == "premium":
                        profile["agency_commission_bp"] = 6000
                        profile["agency_discount_bp"] = 1500
                    profile["agency_joined_at"] = profile.get("agency_joined_at") or _now_iso()
                elif kind in {"subscription_monthly", "subscription_quarterly", "subscription_yearly"}:
                    tier = str(order.get("subscription_tier") or "").strip()
                    base = _parse_iso(profile.get("subscription_expire_at")) or _now()
                    if base < _now():
                        base = _now()
                    months = {"monthly": 1, "quarterly": 3, "yearly": 12}.get(tier, 1)
                    expire_at = _add_months(base, months)
                    profile["subscription_tier"] = tier
                    profile["subscription_start_at"] = profile.get("subscription_start_at") or _now_iso()
                    profile["subscription_expire_at"] = _to_iso(expire_at)
                    profile["subscription_active"] = True
                profile["updated_at"] = _now_iso()
                order["balance_after_cents"] = int(profile.get("balance_cents") or 0)
                profiles[user_id] = profile
                orders[index] = order
                self._save_profiles(profiles)
                self._save_orders(orders)
                return True, copy.deepcopy(order)
        raise ValueError("order not found")

    @staticmethod
    def _new_invite_code() -> str:
        return secrets.token_hex(4)

    @staticmethod
    def _new_order_no() -> str:
        return f"pay_{_now().strftime('%Y%m%d%H%M%S')}{secrets.token_hex(4)}"

    @staticmethod
    def _yipay_sign(params: dict[str, str], key: str) -> str:
        pairs = [f"{name}={value}" for name, value in sorted(params.items()) if str(value).strip() != ""]
        payload = "&".join(pairs) + str(key).strip()
        return hashlib.md5(payload.encode("utf-8")).hexdigest()

    def list_redeem_codes(self, limit: int = 200) -> list[dict[str, Any]]:
        with self._lock:
            items = self._load_redeem_codes()
        items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return items[: max(1, min(limit, 1000))]

    def create_redeem_codes(
        self,
        amount_cents: int,
        count: int = 1,
        expires_at: str = "",
        note: str = "",
    ) -> list[dict[str, Any]]:
        if amount_cents <= 0:
            raise ValueError("amount is invalid")
        count = max(1, min(int(count or 1), 100))
        expires_at = str(expires_at or "").strip()
        note = str(note or "").strip()
        with self._lock:
            items = self._load_redeem_codes()
            created: list[dict[str, Any]] = []
            for _ in range(count):
                item = {
                    "code": secrets.token_hex(4).upper(),
                    "amount_cents": amount_cents,
                    "amount_yuan": f"{amount_cents / 100:.2f}",
                    "enabled": True,
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                    "expires_at": expires_at,
                    "used_by": "",
                    "used_at": "",
                    "note": note,
                }
                items.append(item)
                created.append(copy.deepcopy(item))
            self._save_redeem_codes(items)
            return created

    def update_redeem_code(self, code: str, *, enabled: bool | None = None, expires_at: str | None = None, note: str | None = None) -> dict[str, Any]:
        normalized_code = str(code or "").strip().upper()
        if not normalized_code:
            raise ValueError("redeem code is required")
        with self._lock:
            items = self._load_redeem_codes()
            for index, item in enumerate(items):
                if str(item.get("code") or "").strip().upper() != normalized_code:
                    continue
                next_item = dict(item)
                if enabled is not None:
                    next_item["enabled"] = bool(enabled)
                if expires_at is not None:
                    next_item["expires_at"] = str(expires_at).strip()
                if note is not None:
                    next_item["note"] = str(note).strip()
                next_item["updated_at"] = _now_iso()
                items[index] = next_item
                self._save_redeem_codes(items)
                return copy.deepcopy(next_item)
        raise ValueError("redeem code not found")

    def delete_redeem_code(self, code: str) -> None:
        normalized_code = str(code or "").strip().upper()
        if not normalized_code:
            raise ValueError("redeem code is required")
        with self._lock:
            items = self._load_redeem_codes()
            next_items = [item for item in items if str(item.get("code") or "").strip().upper() != normalized_code]
            if len(next_items) == len(items):
                raise ValueError("redeem code not found")
            self._save_redeem_codes(next_items)

    def agency_dashboard(self, identity: dict[str, Any], register_url: str) -> dict[str, Any]:
        profile = self.get_wallet(identity)
        user_id = str(profile.get("user_id") or "").strip()
        orders = [item for item in self.list_orders(identity, 500) if str(item.get("order_kind") or item.get("type") or "").strip() in {"agency_join", "agency_upgrade", "recharge"}]
        withdrawals = self.list_withdrawals(identity, 200)
        total_commission_cents = 0
        pending_commission_cents = 0
        today_commission_cents = 0
        month_commission_cents = 0
        now = _now()
        for item in orders:
            if str(item.get("status") or "").strip().lower() != "paid":
                continue
            cents = int(item.get("commission_cents") or 0)
            total_commission_cents += cents
            created_at = _parse_iso(item.get("created_at"))
            if created_at and created_at.date() == now.date():
                today_commission_cents += cents
            if created_at and created_at.year == now.year and created_at.month == now.month:
                month_commission_cents += cents
        for item in orders:
            if str(item.get("status") or "").strip().lower() == "pending":
                pending_commission_cents += int(item.get("commission_cents") or 0)
        available_cents = max(0, int(profile.get("balance_cents") or 0))
        return {
            "agent": {
                "user_id": user_id,
                "email": str(profile.get("name") or ""),
                "name": str(profile.get("name") or ""),
                "tier": str(profile.get("agency_tier") or ""),
                "enabled": bool(profile.get("agency_enabled")),
                "commission_bp": int(profile.get("agency_commission_bp") or 0),
                "discount_bp": int(profile.get("agency_discount_bp") or 0),
                "joined_at": str(profile.get("agency_joined_at") or ""),
                "invite_code": str(profile.get("invite_code") or ""),
                "channel_link": f"{register_url.rstrip('/')}?invite_code={str(profile.get('invite_code') or '')}",
                "invited_count": int(profile.get("invited_count") or 0),
                "invited_users": profile.get("invited_users") if isinstance(profile.get("invited_users"), list) else [],
                "wallet_balance": available_cents,
            },
            "summary": {
                "today_commission_cents": today_commission_cents,
                "today_commission_yuan": f"{today_commission_cents / 100:.2f}",
                "month_commission_cents": month_commission_cents,
                "month_commission_yuan": f"{month_commission_cents / 100:.2f}",
                "total_commission_cents": total_commission_cents,
                "total_commission_yuan": f"{total_commission_cents / 100:.2f}",
                "available_cents": available_cents,
                "available_yuan": f"{available_cents / 100:.2f}",
            },
            "orders": copy.deepcopy(orders),
            "withdrawals": copy.deepcopy(withdrawals),
        }

    def agency_withdraw_profile(self, identity: dict[str, Any]) -> dict[str, Any]:
        profile = self.get_wallet(identity)
        return {
            "alipay_qr_code": str(profile.get("agency_alipay_qr_code") or ""),
            "wechat_qr_code": str(profile.get("agency_wechat_qr_code") or ""),
            "phone": str(profile.get("agency_phone") or ""),
            "wechat_id": str(profile.get("agency_wechat_id") or ""),
        }

    def update_agency_withdraw_profile(
        self,
        identity: dict[str, Any],
        alipay_qr_code: str = "",
        wechat_qr_code: str = "",
        phone: str = "",
        wechat_id: str = "",
    ) -> dict[str, Any]:
        subject = _sanitize_identity(identity)
        with self._lock:
            profiles = self._load_profiles()
            profile = profiles.get(subject["id"]) or self.ensure_profile(identity)
            profile["agency_alipay_qr_code"] = str(alipay_qr_code or "").strip()
            profile["agency_wechat_qr_code"] = str(wechat_qr_code or "").strip()
            profile["agency_phone"] = str(phone or "").strip()
            profile["agency_wechat_id"] = str(wechat_id or "").strip()
            profile["updated_at"] = _now_iso()
            profiles[subject["id"]] = profile
            self._save_profiles(profiles)
        return self.agency_withdraw_profile(identity)

    def create_withdrawal(
        self,
        identity: dict[str, Any],
        amount_cents: int,
        alipay_qr_code: str = "",
        wechat_qr_code: str = "",
        phone: str = "",
        wechat_id: str = "",
    ) -> dict[str, Any]:
        if amount_cents <= 0:
            raise ValueError("withdraw amount is required")
        subject = _sanitize_identity(identity)
        with self._lock:
            profiles = self._load_profiles()
            profile = profiles.get(subject["id"]) or self.ensure_profile(identity)
            balance_cents = int(profile.get("balance_cents") or 0)
            if amount_cents > balance_cents:
                raise ValueError("insufficient withdrawable balance")
            profile["balance_cents"] = balance_cents - amount_cents
            profile["updated_at"] = _now_iso()
            profiles[subject["id"]] = profile
            items = self._load_withdrawals()
            item = {
                "id": secrets.token_hex(8),
                "user_id": subject["id"],
                "user_email": subject["name"],
                "amount_cents": amount_cents,
                "amount_yuan": f"{amount_cents / 100:.2f}",
                "alipay_qr_code": str(alipay_qr_code or "").strip(),
                "wechat_qr_code": str(wechat_qr_code or "").strip(),
                "phone": str(phone or "").strip(),
                "wechat_id": str(wechat_id or "").strip(),
                "status": "pending",
                "admin_note": "",
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "processed_at": "",
            }
            items.append(item)
            self._save_profiles(profiles)
            self._save_withdrawals(items)
            return copy.deepcopy(item)

    def list_withdrawals(self, identity: dict[str, Any], limit: int = 100) -> list[dict[str, Any]]:
        user_id = _sanitize_identity(identity)["id"]
        with self._lock:
            items = [item for item in self._load_withdrawals() if str(item.get("user_id") or "").strip() == user_id]
        items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return items[: max(1, min(limit, 500))]

    def list_admin_withdrawals(self, limit: int = 500) -> list[dict[str, Any]]:
        with self._lock:
            items = self._load_withdrawals()
        items.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return items[: max(1, min(limit, 2000))]

    def update_admin_withdrawal(self, item_id: str, status: str, admin_note: str = "") -> dict[str, Any]:
        normalized_id = str(item_id or "").strip()
        normalized_status = str(status or "").strip().lower()
        if normalized_status not in {"pending", "approved", "paid", "rejected"}:
            raise ValueError("invalid withdrawal status")
        with self._lock:
            items = self._load_withdrawals()
            profiles = self._load_profiles()
            for index, item in enumerate(items):
                if str(item.get("id") or "").strip() != normalized_id:
                    continue
                previous_status = str(item.get("status") or "").strip().lower()
                next_item = dict(item)
                next_item["status"] = normalized_status
                next_item["admin_note"] = str(admin_note or "").strip()
                next_item["updated_at"] = _now_iso()
                if normalized_status in {"approved", "paid", "rejected"}:
                    next_item["processed_at"] = _now_iso()
                if normalized_status == "rejected" and previous_status != "rejected":
                    user_id = str(item.get("user_id") or "").strip()
                    profile = profiles.get(user_id)
                    if profile is not None:
                        profile["balance_cents"] = int(profile.get("balance_cents") or 0) + int(item.get("amount_cents") or 0)
                        profile["updated_at"] = _now_iso()
                        profiles[user_id] = profile
                items[index] = next_item
                self._save_withdrawals(items)
                self._save_profiles(profiles)
                return copy.deepcopy(next_item)
        raise ValueError("withdrawal not found")

    def list_agency_admin_users(self) -> list[dict[str, Any]]:
        with self._lock:
            profiles = self._load_profiles()
        items = []
        for profile in profiles.values():
            if not str(profile.get("agency_tier") or "").strip():
                continue
            items.append({
                "id": str(profile.get("user_id") or "").strip(),
                "email": str(profile.get("name") or "").strip(),
                "name": str(profile.get("name") or "").strip(),
                "agency_tier": str(profile.get("agency_tier") or "").strip(),
                "agency_enabled": bool(profile.get("agency_enabled")),
                "agency_commission_bp": int(profile.get("agency_commission_bp") or 0),
                "agency_discount_bp": int(profile.get("agency_discount_bp") or 0),
                "agency_joined_at": str(profile.get("agency_joined_at") or "").strip(),
            })
        items.sort(key=lambda item: str(item.get("agency_joined_at") or ""), reverse=True)
        return items

    def activate_agency_user(self, user_id: str, tier: str) -> dict[str, Any]:
        normalized_user_id = str(user_id or "").strip()
        normalized_tier = str(tier or "").strip().lower()
        if normalized_tier not in {"basic", "pro", "premium"}:
            raise ValueError("invalid agency tier")
        with self._lock:
            profiles = self._load_profiles()
            profile = profiles.get(normalized_user_id)
            if profile is None:
                raise ValueError("user not found")
            profile["agency_tier"] = normalized_tier
            profile["agency_enabled"] = True
            profile["agency_joined_at"] = profile.get("agency_joined_at") or _now_iso()
            if normalized_tier == "basic":
                profile["agency_commission_bp"] = 3000
                profile["agency_discount_bp"] = 500
            elif normalized_tier == "pro":
                profile["agency_commission_bp"] = 4500
                profile["agency_discount_bp"] = 1000
            else:
                profile["agency_commission_bp"] = 6000
                profile["agency_discount_bp"] = 1500
            profile["updated_at"] = _now_iso()
            profiles[normalized_user_id] = profile
            self._save_profiles(profiles)
            return copy.deepcopy(profile)


commerce_service = CommerceService()

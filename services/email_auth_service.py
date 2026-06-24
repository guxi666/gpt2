from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from services.auth_service import auth_service
from services.commerce_service import commerce_service
from services.config import DATA_DIR, config
from services.role_service import DEFAULT_ROLE_ID, role_service

try:
    import bcrypt as bcrypt_lib  # type: ignore
except Exception:  # pragma: no cover
    bcrypt_lib = None

import smtplib
import ssl
from email.message import EmailMessage


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _clean(value: object) -> str:
    return str(value or "").strip()


ALLOWED_EMAIL_DOMAINS = {
    "qq.com",
    "163.com",
    "126.com",
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "yahoo.com",
    "foxmail.com",
    "sina.com",
}


def _normalize_allowed_email(email: str) -> str:
    normalized_email = _clean(email).lower()
    if not normalized_email or "@" not in normalized_email:
        raise ValueError("email is invalid")
    domain = normalized_email.rsplit("@", 1)[-1]
    if domain not in ALLOWED_EMAIL_DOMAINS:
        raise ValueError("email domain is not allowed")
    return normalized_email


class EmailAuthService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._users_path = DATA_DIR / "email_auth_users.json"
        self._codes_path = DATA_DIR / "email_auth_codes.json"
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _load_json(path: Path, default: Any) -> Any:
        if not path.exists():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default

    @staticmethod
    def _save_json(path: Path, value: Any) -> None:
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def _load_users(self) -> list[dict[str, Any]]:
        raw = self._load_json(self._users_path, [])
        return raw if isinstance(raw, list) else []

    def _save_users(self, users: list[dict[str, Any]]) -> None:
        self._save_json(self._users_path, users)

    def _load_codes(self) -> dict[str, dict[str, Any]]:
        raw = self._load_json(self._codes_path, {})
        return raw if isinstance(raw, dict) else {}

    def _save_codes(self, codes: dict[str, dict[str, Any]]) -> None:
        self._save_json(self._codes_path, codes)

    def providers(self) -> dict[str, Any]:
        settings = config.get()
        return {
            "key_login": {"enabled": True},
            "registration": {"enabled": bool(settings.get("email_smtp_enabled"))},
            "email_verification": {"enabled": bool(settings.get("email_smtp_enabled"))},
        }

    def smtp_ready(self) -> bool:
        settings = config.get()
        return bool(
            settings.get("email_smtp_enabled")
            and _clean(settings.get("email_smtp_host"))
            and int(settings.get("email_smtp_port") or 0) > 0
            and _clean(settings.get("email_smtp_username"))
            and _clean(settings.get("email_smtp_auth_code"))
            and _clean(settings.get("email_smtp_from_email"))
        )

    def send_register_code(self, email: str) -> None:
        if not self.smtp_ready():
            raise ValueError("email verification is not configured")
        normalized_email = _normalize_allowed_email(email)
        code = f"{secrets.randbelow(1000000):06d}"
        self._send_mail(
            normalized_email,
            "邮箱验证码",
            f"您的验证码是：{code}\n10分钟内有效。",
        )
        with self._lock:
            codes = self._load_codes()
            codes[normalized_email] = {
                "code_hash": hashlib.sha256(code.encode("utf-8")).hexdigest(),
                "expires_at": (_now() + timedelta(minutes=10)).isoformat(),
                "updated_at": _now_iso(),
            }
            self._save_codes(codes)

    def register(self, email: str, password: str, code: str, name: str = "") -> tuple[dict[str, Any], str]:
        normalized_email = _normalize_allowed_email(email)
        if len(_clean(password)) < 6:
            raise ValueError("password is too short")
        self._verify_code(normalized_email, code)
        with self._lock:
            users = self._load_users()
            if any(_clean(item.get("email")).lower() == normalized_email for item in users):
                raise ValueError("email already exists")
            user_id = f"user_{secrets.token_hex(6)}"
            salt = secrets.token_hex(16)
            password_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 480000).hex()
            role = role_service.get_role(DEFAULT_ROLE_ID) or {"id": DEFAULT_ROLE_ID, "name": "默认用户", "menu_paths": [], "api_permissions": []}
            auth_item, raw_key, _ = auth_service.import_user(
                user_id=user_id,
                username=normalized_email,
                name=_clean(name) or normalized_email,
                role_id=str(role.get("id") or DEFAULT_ROLE_ID),
                role_name=str(role.get("name") or ""),
                enabled=True,
                provider="email",
                menu_paths=role.get("menu_paths") if isinstance(role.get("menu_paths"), list) else [],
                api_permissions=role.get("api_permissions") if isinstance(role.get("api_permissions"), list) else [],
            )
            user = {
                "id": user_id,
                "email": normalized_email,
                "name": _clean(name) or normalized_email,
                "password_scheme": "pbkdf2_sha256",
                "password_hash": password_hash,
                "password_salt": salt,
                "role_id": str(role.get("id") or DEFAULT_ROLE_ID),
                "enabled": True,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "last_login_at": "",
            }
            users.append(user)
            self._save_users(users)
            commerce_service.grant_signup_bonus(auth_item)
            return auth_item, raw_key

    def login(self, email: str, password: str) -> tuple[dict[str, Any], str]:
        normalized_identity = _clean(email).lower()
        with self._lock:
            users = self._load_users()
            user = next((item for item in users if self._matches_login_identity(item, normalized_identity)), None)
            if user is None:
                raise ValueError("email or password is invalid")
            if not bool(user.get("enabled", True)):
                raise ValueError("user is disabled")
            if not self._verify_password(user, password):
                raise ValueError("email or password is invalid")
            role = role_service.get_role(str(user.get("role_id") or DEFAULT_ROLE_ID)) or {"id": DEFAULT_ROLE_ID, "name": "默认用户", "menu_paths": [], "api_permissions": []}
            auth_item, raw_key, _ = auth_service.import_user(
                user_id=str(user.get("id") or ""),
                username=_clean(user.get("username")) or _clean(user.get("email")).lower(),
                name=str(user.get("name") or _clean(user.get("username")) or _clean(user.get("email")).lower()),
                role_id=str(role.get("id") or DEFAULT_ROLE_ID),
                role_name=str(role.get("name") or ""),
                enabled=True,
                provider="email",
                menu_paths=role.get("menu_paths") if isinstance(role.get("menu_paths"), list) else [],
                api_permissions=role.get("api_permissions") if isinstance(role.get("api_permissions"), list) else [],
            )
            if not raw_key:
                rotated = auth_service.rotate_key(str(auth_item.get("id") or ""), role="user")
                if rotated is None:
                    raise ValueError("failed to issue login key")
                auth_item, raw_key = rotated
            user["last_login_at"] = _now_iso()
            user["updated_at"] = _now_iso()
            self._save_users(users)
            return auth_item, raw_key

    def import_legacy_user(self, raw_user: dict[str, Any]) -> None:
        email = _clean(raw_user.get("email")).lower()
        if not email:
            return
        user_id = _clean(raw_user.get("id")) or f"user_{secrets.token_hex(6)}"
        role_id = _clean(raw_user.get("role_id")) or DEFAULT_ROLE_ID
        role = role_service.get_role(role_id) or {"id": DEFAULT_ROLE_ID, "name": "默认用户", "menu_paths": [], "api_permissions": []}
        with self._lock:
            users = self._load_users()
            if any(_clean(item.get("email")).lower() == email for item in users):
                return
            users.append({
                "id": user_id,
                "email": email,
                "username": _clean(raw_user.get("username")) or email,
                "name": _clean(raw_user.get("name")) or email,
                "password_scheme": "legacy_bcrypt",
                "password_hash": _clean(raw_user.get("password_hash")),
                "password_salt": "",
                "role_id": role_id,
                "enabled": bool(raw_user.get("enabled", True)),
                "created_at": _clean(raw_user.get("created_at")) or _now_iso(),
                "updated_at": _clean(raw_user.get("updated_at")) or _now_iso(),
                "last_login_at": _clean(raw_user.get("last_login_at")),
            })
            self._save_users(users)
        auth_service.import_user(
            user_id=user_id,
            username=email,
            name=_clean(raw_user.get("name")) or email,
            role_id=str(role.get("id") or DEFAULT_ROLE_ID),
            role_name=str(role.get("name") or ""),
            enabled=bool(raw_user.get("enabled", True)),
            provider="email",
            menu_paths=role.get("menu_paths") if isinstance(role.get("menu_paths"), list) else [],
            api_permissions=role.get("api_permissions") if isinstance(role.get("api_permissions"), list) else [],
        )

    def list_managed_users(self) -> list[dict[str, Any]]:
        role_map = {str(item.get("id") or "").strip(): item for item in role_service.list_roles()}
        items: list[dict[str, Any]] = []
        with self._lock:
            users = self._load_users()
        for user in users:
            role_id = _clean(user.get("role_id")) or DEFAULT_ROLE_ID
            role = role_map.get(role_id) or role_map.get(DEFAULT_ROLE_ID) or {}
            email = _clean(user.get("email")).lower()
            username = _clean(user.get("username")) or email
            items.append({
                "id": _clean(user.get("id")) or f"user_{secrets.token_hex(6)}",
                "username": username,
                "email": email,
                "name": _clean(user.get("name")) or email,
                "role": "user",
                "role_id": str(role.get("id") or role_id),
                "role_name": str(role.get("name") or ""),
                "provider": "email",
                "enabled": bool(user.get("enabled", True)),
                "has_api_key": False,
                "has_session": False,
                "api_key_id": "",
                "api_key_name": "",
                "credential_count": 1,
                "created_at": _clean(user.get("created_at")) or "",
                "last_used_at": _clean(user.get("last_login_at")) or "",
                "menu_paths": role.get("menu_paths") if isinstance(role.get("menu_paths"), list) else [],
                "api_permissions": role.get("api_permissions") if isinstance(role.get("api_permissions"), list) else [],
                "has_password": bool(_clean(user.get("password_hash"))),
            })
        return items

    def _verify_code(self, email: str, code: str) -> None:
        with self._lock:
            codes = self._load_codes()
            current = codes.get(email)
            if not isinstance(current, dict):
                raise ValueError("verification code is not sent")
            expires_at = current.get("expires_at")
            if not expires_at or datetime.fromisoformat(str(expires_at).replace("Z", "+00:00")) < _now():
                raise ValueError("verification code is expired")
            if hashlib.sha256(_clean(code).encode("utf-8")).hexdigest() != _clean(current.get("code_hash")):
                raise ValueError("verification code is invalid")
            codes.pop(email, None)
            self._save_codes(codes)

    def _verify_password(self, user: dict[str, Any], password: str) -> bool:
        scheme = _clean(user.get("password_scheme"))
        if scheme == "legacy_bcrypt":
            if bcrypt_lib is None:
                return False
            try:
                return bool(bcrypt_lib.checkpw(password.encode("utf-8"), _clean(user.get("password_hash")).encode("utf-8")))
            except Exception:
                return False
        salt = _clean(user.get("password_salt"))
        expected = _clean(user.get("password_hash"))
        if not salt or not expected:
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 480000).hex()
        return hmac.compare_digest(actual, expected)

    @staticmethod
    def _matches_login_identity(user: dict[str, Any], identity: str) -> bool:
        normalized = _clean(identity).lower()
        if not normalized:
            return False
        return normalized in {
            _clean(user.get("email")).lower(),
            _clean(user.get("username")).lower(),
        }

    def _send_mail(self, to_email: str, subject: str, body: str) -> None:
        settings = config.get()
        host = _clean(settings.get("email_smtp_host"))
        port = int(settings.get("email_smtp_port") or 465)
        username = _clean(settings.get("email_smtp_username"))
        password = _clean(settings.get("email_smtp_auth_code"))
        from_email = _clean(settings.get("email_smtp_from_email"))
        from_name = _clean(settings.get("email_smtp_from_name")) or "GPT生图站"

        message = EmailMessage()
        message["From"] = f"{from_name} <{from_email}>"
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)

        if bool(settings.get("email_smtp_use_ssl", True)):
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                server.login(username, password)
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(username, password)
                server.send_message(message)


email_auth_service = EmailAuthService()

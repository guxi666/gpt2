from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from api.support import require_admin, require_identity, resolve_image_base_url
from services.commerce_service import YiPayConfig, commerce_service
from services.config import config


class RechargeOrderRequest(BaseModel):
    amount: str = ""
    amount_cents: int = 0
    pay_type: str = "alipay"


class RedeemCodeRequest(BaseModel):
    code: str = ""


class AgencyOrderRequest(BaseModel):
    tier: str = ""
    pay_type: str = "alipay"


class SubscriptionOrderRequest(BaseModel):
    tier: str = ""
    pay_type: str = "alipay"


class WithdrawalRequestBody(BaseModel):
    amount_cents: int = 0
    alipay_qr_code: str = ""
    wechat_qr_code: str = ""
    phone: str = ""
    wechat_id: str = ""


class WithdrawalProfileBody(BaseModel):
    alipay_qr_code: str = ""
    wechat_qr_code: str = ""
    phone: str = ""
    wechat_id: str = ""


class AdminWithdrawalUpdateBody(BaseModel):
    id: str = ""
    status: str = "pending"
    admin_note: str = ""


class AdminAgencyUserBody(BaseModel):
    user_id: str = ""
    tier: str = ""


class RedeemCodeCreateBody(BaseModel):
    amount_cents: int = 0
    amount: str = ""
    count: int = 1
    expires_at: str = ""
    note: str = ""


class RedeemCodeUpdateBody(BaseModel):
    enabled: bool | None = None
    expires_at: str | None = None
    note: str | None = None


class AdminBalanceBody(BaseModel):
    delta_cents: int | None = None
    balance_cents: int | None = None
    note: str = ""


class AdminSubscriptionBody(BaseModel):
    mode: str = "extend"
    tier: str = ""
    expire_at: str = ""
    extend_days: int = 0


def _yi_pay_config(request: Request, *, return_path: str) -> YiPayConfig:
    settings = config.get()
    base_url = resolve_image_base_url(request).rstrip("/")
    notify_url = str(settings.get("yipay_notify_url") or "").strip() or f"{base_url}/api/pay/yipay/notify"
    return_url = str(settings.get("yipay_return_url") or "").strip() or f"{base_url}{return_path}"
    return YiPayConfig(
        enabled=bool(settings.get("yipay_enabled")),
        pid=str(settings.get("yipay_pid") or "").strip(),
        key=str(settings.get("yipay_key") or "").strip(),
        submit_url=str(settings.get("yipay_submit_url") or "").strip(),
        notify_url=notify_url,
        return_url=return_url,
        site_name=str(settings.get("yipay_site_name") or "chatgpt2api").strip() or "chatgpt2api",
    )


def _pay_channels() -> list[str]:
    settings = config.get()
    items: list[str] = []
    if bool(settings.get("yipay_enabled")):
        items.extend(["alipay", "wxpay"])
    if bool(settings.get("paypal_enabled")):
        items.append("paypal")
    if bool(settings.get("usdt_enabled")):
        items.append("usdt")
    return list(dict.fromkeys(items))


def _agency_tiers() -> list[dict]:
    settings = config.get()
    return [
        {
            "key": "basic",
            "name": str(settings.get("agency_tier_basic_name") or "基础代理"),
            "price_cents": int(settings.get("agency_tier_basic_cents") or 19900),
            "price_yuan": round(int(settings.get("agency_tier_basic_cents") or 19900) / 100, 2),
            "description": str(settings.get("agency_tier_basic_desc") or "入门代理套餐，适合个人起步"),
            "commission_bp": int(settings.get("agency_tier_basic_commission_bp") or 3000),
            "discount_bp": int(settings.get("agency_tier_basic_discount_bp") or 500),
        },
        {
            "key": "pro",
            "name": str(settings.get("agency_tier_pro_name") or "进阶代理"),
            "price_cents": int(settings.get("agency_tier_pro_cents") or 49900),
            "price_yuan": round(int(settings.get("agency_tier_pro_cents") or 49900) / 100, 2),
            "description": str(settings.get("agency_tier_pro_desc") or "进阶代理套餐，适合团队运营"),
            "commission_bp": int(settings.get("agency_tier_pro_commission_bp") or 4500),
            "discount_bp": int(settings.get("agency_tier_pro_discount_bp") or 1000),
        },
        {
            "key": "premium",
            "name": str(settings.get("agency_tier_premium_name") or "旗舰代理"),
            "price_cents": int(settings.get("agency_tier_premium_cents") or 99900),
            "price_yuan": round(int(settings.get("agency_tier_premium_cents") or 99900) / 100, 2),
            "description": str(settings.get("agency_tier_premium_desc") or "旗舰代理套餐，适合规模业务"),
            "commission_bp": int(settings.get("agency_tier_premium_commission_bp") or 6000),
            "discount_bp": int(settings.get("agency_tier_premium_discount_bp") or 1500),
        },
    ]


def _subscription_plans() -> list[dict]:
    settings = config.get()
    return [
        {
            "key": "monthly",
            "name": str(settings.get("subscription_monthly_name") or "包月套餐"),
            "description": str(settings.get("subscription_monthly_desc") or "适合轻量和日常创作"),
            "badge": str(settings.get("subscription_monthly_badge") or ""),
            "price_cents": int(settings.get("subscription_monthly_price_cents") or 1990),
            "price_note": str(settings.get("subscription_monthly_price_note") or ""),
            "features": [item for item in str(settings.get("subscription_monthly_features") or "无限生图\n套餐期内不扣余额").splitlines() if item.strip()],
            "period_label": "每月",
        },
        {
            "key": "quarterly",
            "name": str(settings.get("subscription_quarterly_name") or "包季套餐"),
            "description": str(settings.get("subscription_quarterly_desc") or "性价比更高"),
            "badge": str(settings.get("subscription_quarterly_badge") or "推荐"),
            "price_cents": int(settings.get("subscription_quarterly_price_cents") or 4990),
            "price_note": str(settings.get("subscription_quarterly_price_note") or ""),
            "features": [item for item in str(settings.get("subscription_quarterly_features") or "无限生图\n套餐期内不扣余额").splitlines() if item.strip()],
            "period_label": "每季",
        },
        {
            "key": "yearly",
            "name": str(settings.get("subscription_yearly_name") or "包年套餐"),
            "description": str(settings.get("subscription_yearly_desc") or "长期使用更省心"),
            "badge": str(settings.get("subscription_yearly_badge") or "最优惠"),
            "price_cents": int(settings.get("subscription_yearly_price_cents") or 15900),
            "price_note": str(settings.get("subscription_yearly_price_note") or ""),
            "features": [item for item in str(settings.get("subscription_yearly_features") or "无限生图\n套餐期内不扣余额").splitlines() if item.strip()],
            "period_label": "每年",
        },
    ]


def create_router() -> APIRouter:
    router = APIRouter()

    @router.get("/api/wallet")
    async def get_wallet(authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        wallet = commerce_service.get_wallet(identity)
        return {
            "wallet": wallet,
            "image_price": int(config.get().get("image_price_cents") or 8),
            "pay_channels": _pay_channels(),
        }

    @router.post("/api/wallet/redeem")
    async def redeem_code(body: RedeemCodeRequest, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        try:
            wallet = commerce_service.redeem_code(identity, body.code)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"ok": True, "wallet": wallet}

    @router.get("/api/pay/orders")
    async def list_pay_orders(authorization: str | None = Header(default=None), limit: int = 100):
        identity = require_identity(authorization)
        return {"items": commerce_service.list_orders(identity, limit)}

    @router.post("/api/pay/orders")
    async def create_pay_order(body: RechargeOrderRequest, request: Request, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        amount_cents = body.amount_cents
        if amount_cents <= 0:
            try:
                amount_cents = int(round(float(body.amount or "0") * 100))
            except Exception:
                amount_cents = 0
        try:
            order = commerce_service.create_yipay_order(
                identity,
                amount_cents,
                body.pay_type,
                _yi_pay_config(request, return_path="/wallet"),
                order_kind="recharge",
                note="wallet recharge",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"order": order}

    @router.get("/api/admin/billing/orders")
    async def get_admin_billing_orders(limit: int = 300, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        return {
            "items": commerce_service.list_all_orders(limit),
            "stats": commerce_service.billing_stats(),
        }

    @router.get("/api/admin/billing/users")
    async def get_admin_billing_users(authorization: str | None = Header(default=None)):
        require_admin(authorization)
        return {"items": commerce_service.list_profiles()}

    @router.post("/api/admin/billing/users/{user_id}/balance")
    async def update_admin_billing_user_balance(user_id: str, body: AdminBalanceBody, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        try:
            wallet = commerce_service.update_balance(
                user_id,
                delta_cents=body.delta_cents,
                balance_cents=body.balance_cents,
                note=body.note,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"wallet": wallet, "items": commerce_service.list_profiles()}

    @router.post("/api/admin/billing/users/{user_id}/subscription")
    async def update_admin_billing_user_subscription(user_id: str, body: AdminSubscriptionBody, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        try:
            status = commerce_service.update_subscription(
                user_id,
                mode=body.mode,
                tier=body.tier,
                expire_at=body.expire_at,
                extend_days=body.extend_days,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"status": status, "items": commerce_service.list_profiles()}

    @router.get("/api/admin/billing/redeem-codes")
    async def get_redeem_codes(limit: int = 200, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        return {"items": commerce_service.list_redeem_codes(limit)}

    @router.post("/api/admin/billing/redeem-codes")
    async def create_redeem_codes(body: RedeemCodeCreateBody, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        amount_cents = body.amount_cents
        if amount_cents <= 0:
            try:
                amount_cents = int(round(float(body.amount or "0") * 100))
            except Exception:
                amount_cents = 0
        try:
            created = commerce_service.create_redeem_codes(
                amount_cents,
                body.count,
                body.expires_at,
                body.note,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"items": commerce_service.list_redeem_codes(200), "created": created}

    @router.post("/api/admin/billing/redeem-codes/{code}")
    async def update_redeem_code(code: str, body: RedeemCodeUpdateBody, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        try:
            item = commerce_service.update_redeem_code(
                code,
                enabled=body.enabled,
                expires_at=body.expires_at,
                note=body.note,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"item": item, "items": commerce_service.list_redeem_codes(200)}

    @router.delete("/api/admin/billing/redeem-codes/{code}")
    async def delete_redeem_code(code: str, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        try:
            commerce_service.delete_redeem_code(code)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"items": commerce_service.list_redeem_codes(200)}

    @router.api_route("/api/pay/yipay/notify", methods=["GET", "POST"])
    async def yipay_notify(request: Request):
        values = dict((await request.form()).multi_items()) if request.method == "POST" else dict(request.query_params)
        try:
            ok, _ = commerce_service.handle_yipay_notify(values, _yi_pay_config(request, return_path="/wallet"))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"ok": ok}

    @router.get("/api/agency")
    async def get_agency(authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        editable = identity.get("role") == "admin"
        settings = config.get()
        materials = settings.get("agency_materials")
        return {
            "editable": editable,
            "enabled": bool(settings.get("agency_enabled", True)),
            "tiers": _agency_tiers(),
            "materials": materials if isinstance(materials, list) else [],
            "material_qr": {
                "enabled": bool(settings.get("agency_material_qr_enabled", True)),
                "x_percent": int(settings.get("agency_material_qr_x_percent") or 72),
                "y_percent": int(settings.get("agency_material_qr_y_percent") or 72),
                "size_percent": int(settings.get("agency_material_qr_size_percent") or 26),
                "logo_percent": int(settings.get("agency_material_qr_logo_percent") or 24),
            },
        }

    @router.post("/api/agency")
    async def update_agency_settings(body: dict, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        try:
            updated = config.update(body)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"config": updated}

    @router.post("/api/agency/join")
    async def join_agency(body: AgencyOrderRequest, request: Request, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        tier = body.tier.strip().lower()
        match = next((item for item in _agency_tiers() if item["key"] == tier), None)
        if not match:
            raise HTTPException(status_code=400, detail={"error": "invalid agency tier"})
        try:
            order = commerce_service.create_yipay_order(
                identity,
                int(match["price_cents"]),
                body.pay_type,
                _yi_pay_config(request, return_path="/agency"),
                order_kind="agency_join",
                agency_tier=tier,
                note=f"agency {tier}",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"ok": True, "pending_payment": True, "tier": tier, "order": order}

    @router.post("/api/agency/upgrade")
    async def upgrade_agency(body: AgencyOrderRequest, request: Request, authorization: str | None = Header(default=None)):
        return await join_agency(body, request, authorization)

    @router.get("/api/agency/commission")
    async def get_agency_commission_dashboard(request: Request, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        register_url = f"{resolve_image_base_url(request).rstrip('/')}/login"
        return commerce_service.agency_dashboard(identity, register_url)

    @router.get("/api/agency/withdrawals")
    async def list_agency_withdrawals(limit: int = 100, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        return {"items": commerce_service.list_withdrawals(identity, limit)}

    @router.post("/api/agency/withdrawals")
    async def create_agency_withdrawal(body: WithdrawalRequestBody, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        try:
            item = commerce_service.create_withdrawal(
                identity,
                body.amount_cents,
                body.alipay_qr_code,
                body.wechat_qr_code,
                body.phone,
                body.wechat_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"ok": True, "item": item}

    @router.get("/api/agency/withdraw-profile")
    async def get_agency_withdraw_profile(authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        return {"profile": commerce_service.agency_withdraw_profile(identity)}

    @router.post("/api/agency/withdraw-profile")
    async def save_agency_withdraw_profile(body: WithdrawalProfileBody, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        profile = commerce_service.update_agency_withdraw_profile(
            identity,
            body.alipay_qr_code,
            body.wechat_qr_code,
            body.phone,
            body.wechat_id,
        )
        return {"ok": True, "profile": profile}

    @router.get("/api/agency/admin/users")
    async def get_agency_admin_users(authorization: str | None = Header(default=None)):
        require_admin(authorization)
        return {"items": commerce_service.list_agency_admin_users()}

    @router.post("/api/agency/admin/users")
    async def activate_admin_agency_user(body: AdminAgencyUserBody, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        try:
            wallet = commerce_service.activate_agency_user(body.user_id, body.tier)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"ok": True, "wallet": wallet, "tier": body.tier}

    @router.get("/api/agency/admin/withdrawals")
    async def get_agency_admin_withdrawals(limit: int = 500, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        return {"items": commerce_service.list_admin_withdrawals(limit)}

    @router.post("/api/agency/admin/withdrawals")
    async def update_agency_admin_withdrawal(body: AdminWithdrawalUpdateBody, authorization: str | None = Header(default=None)):
        require_admin(authorization)
        try:
            item = commerce_service.update_admin_withdrawal(body.id, body.status, body.admin_note)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"ok": True, "item": item}

    @router.get("/api/subscriptions/plans")
    async def get_subscription_plans(authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        wallet = commerce_service.get_wallet(identity)
        settings = config.get()
        return {
            "enabled": bool(settings.get("subscription_enabled", True)),
            "plans": _subscription_plans(),
            "status": {
                "tier": wallet.get("subscription_tier") or "",
                "start_at": wallet.get("subscription_start_at") or "",
                "expire_at": wallet.get("subscription_expire_at") or "",
                "active": bool(wallet.get("subscription_active")),
            },
            "wallet": wallet,
            "pay_channels": _pay_channels(),
            "heading": str(settings.get("subscription_heading") or "选择适合你的套餐"),
            "subheading": str(settings.get("subscription_subheading") or "套餐期内无限生图，不扣余额"),
            "safety_text": str(settings.get("subscription_safety_text") or "安全支付保障·无隐藏费用"),
            "agent_hint": str(settings.get("subscription_agent_hint") or "购买代理充值更优惠"),
        }

    @router.post("/api/subscriptions/orders")
    async def create_subscription_order(body: SubscriptionOrderRequest, request: Request, authorization: str | None = Header(default=None)):
        identity = require_identity(authorization)
        tier = body.tier.strip().lower()
        match = next((item for item in _subscription_plans() if item["key"] == tier), None)
        if not match:
            raise HTTPException(status_code=400, detail={"error": "invalid subscription tier"})
        try:
            order = commerce_service.create_yipay_order(
                identity,
                int(match["price_cents"]),
                body.pay_type,
                _yi_pay_config(request, return_path="/subscription"),
                order_kind=f"subscription_{tier}",
                subscription_tier=tier,
                note=f"subscription {tier}",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
        return {"ok": True, "pending_payment": True, "tier": tier, "order": order}

    return router

import { httpRequest, request } from "@/lib/request";

export type AccountType = string;
export type AccountStatus = "正常" | "限流" | "异常" | "禁用";
export type ImageModel = string;
export type AuthRole = "admin" | "user";
export type ImageStorageMode = "local" | "webdav" | "both";

export type ImageStorageSettings = {
  enabled: boolean;
  mode: ImageStorageMode;
  imgbed_enabled?: boolean;
  imgbed_upload_url?: string;
  imgbed_auth_code?: string;
  imgbed_upload_channel?: string;
  webdav_url: string;
  webdav_username: string;
  webdav_password: string;
  webdav_root_path: string;
  public_base_url: string;
};

export type Account = {
  access_token: string;
  type: AccountType;
  source_type?: string | null;
  status: AccountStatus;
  quota: number;
  image_quota_unknown?: boolean;
  email?: string | null;
  user_id?: string | null;
  limits_progress?: Array<{
    feature_name?: string;
    remaining?: number;
    reset_after?: string;
  }>;
  default_model_slug?: string | null;
  restore_at?: string | null;
  success: number;
  fail: number;
  /** 当前图片在途数(正在生成、尚未结束的图片数)。号池空闲时持续 > 0 表示并发槽位泄漏。 */
  image_inflight?: number;
  last_used_at?: string | null;
  proxy?: string | null;
};

export type AccountImportPayload = {
  access_token: string;
  accessToken?: string;
  type?: string;
  export_type?: string;
  source_type?: string;
  [key: string]: unknown;
};

export type Model = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  permission: unknown[];
  root: string;
  parent: string | null;
};

type AccountListResponse = {
  items: Account[];
};

type ModelListResponse = {
  object: string;
  data: Model[];
};

type AccountMutationResponse = {
  items: Account[];
  added?: number;
  skipped?: number;
  removed?: number;
  refreshed?: number;
  relogined?: number;
  errors?: Array<{ access_token: string; error: string }>;
};

export type AccountRefreshResponse = {
  items: Account[];
  refreshed: number;
  relogined?: number;
  errors: Array<{ access_token: string; error: string }>;
};

export type RefreshProgressResponse = {
  total: number;
  processed: number;
  done: boolean;
  error: string | null;
  status_counts?: Record<string, number>;
  total_quota?: number;
  result?: AccountRefreshResponse | null;
  results?: Array<{ token: string; status: string; error?: string | null }>;
};

type AccountUpdateResponse = {
  item: Account;
  items: Account[];
};

export type ProxyRuntimeEgressMode = "direct" | "single_proxy";
export type ProxyRuntimeClearanceMode = "none" | "manual" | "flaresolverr";

export type ProxyRuntimeClearanceSettings = {
  enabled: boolean;
  mode: ProxyRuntimeClearanceMode;
  cf_cookies: string;
  cf_clearance: string;
  user_agent: string;
  browser: string;
  flaresolverr_url: string;
  timeout_sec: number | string;
  refresh_interval: number | string;
  warm_up_on_start: boolean;
  has_cf_cookies?: boolean;
  has_cf_clearance?: boolean;
};

export type ProxyRuntimeSettings = {
  enabled: boolean;
  egress_mode: ProxyRuntimeEgressMode;
  proxy_url: string;
  resource_proxy_url: string;
  skip_ssl_verify: boolean;
  reset_session_status_codes: number[];
  clearance: ProxyRuntimeClearanceSettings;
};

export type ProxyRuntimeStatus = {
  enabled: boolean;
  egress_mode: ProxyRuntimeEgressMode | string;
  proxy_source: string;
  has_proxy: boolean;
  clearance_enabled: boolean;
  clearance_mode: ProxyRuntimeClearanceMode | string;
  has_clearance_bundle: boolean;
  cached_clearance_hosts: string[];
};

export type ProxyRuntimeResponse = {
  runtime: ProxyRuntimeSettings;
  status: ProxyRuntimeStatus;
};

export type ThirdPartyAppsSettings = {
  infinite_canvas: {
    enabled: boolean;
    url: string;
  };
};

export type SettingsConfig = {
  proxy: string;
  base_url?: string;
  brand_top_left_name?: string;
  brand_site_name?: string;
  brand_top_left_logo_url?: string;
  brand_site_logo_url?: string;
  email_smtp_enabled?: boolean;
  email_smtp_host?: string;
  email_smtp_port?: number | string;
  email_smtp_use_ssl?: boolean;
  email_smtp_username?: string;
  email_smtp_auth_code?: string;
  email_smtp_from_email?: string;
  email_smtp_from_name?: string;
  agency_enabled?: boolean;
  agency_tier_basic_cents?: number | string;
  agency_tier_pro_cents?: number | string;
  agency_tier_premium_cents?: number | string;
  agency_tier_basic_commission_bp?: number | string;
  agency_tier_pro_commission_bp?: number | string;
  agency_tier_premium_commission_bp?: number | string;
  agency_tier_basic_discount_bp?: number | string;
  agency_tier_pro_discount_bp?: number | string;
  agency_tier_premium_discount_bp?: number | string;
  agency_materials?: AgencyMaterial[];
  agency_material_qr_enabled?: boolean;
  agency_material_qr_x_percent?: number | string;
  agency_material_qr_y_percent?: number | string;
  agency_material_qr_size_percent?: number | string;
  agency_material_qr_logo_percent?: number | string;
  subscription_enabled?: boolean;
  subscription_heading?: string;
  subscription_subheading?: string;
  subscription_safety_text?: string;
  subscription_agent_hint?: string;
  subscription_monthly_name?: string;
  subscription_monthly_desc?: string;
  subscription_monthly_badge?: string;
  subscription_monthly_price_cents?: number | string;
  subscription_monthly_price_note?: string;
  subscription_monthly_features?: string;
  subscription_quarterly_name?: string;
  subscription_quarterly_desc?: string;
  subscription_quarterly_badge?: string;
  subscription_quarterly_price_cents?: number | string;
  subscription_quarterly_price_note?: string;
  subscription_quarterly_features?: string;
  subscription_yearly_name?: string;
  subscription_yearly_desc?: string;
  subscription_yearly_badge?: string;
  subscription_yearly_price_cents?: number | string;
  subscription_yearly_price_note?: string;
  subscription_yearly_features?: string;
  yipay_enabled?: boolean;
  yipay_pid?: string;
  yipay_key?: string;
  yipay_submit_url?: string;
  yipay_notify_url?: string;
  yipay_return_url?: string;
  yipay_site_name?: string;
  paypal_enabled?: boolean;
  paypal_checkout_url?: string;
  usdt_enabled?: boolean;
  usdt_network?: string;
  usdt_address?: string;
  usdt_payment_url?: string;
  global_system_prompt?: string;
  sensitive_words?: string[];
  ai_review?: {
    enabled?: boolean;
    base_url?: string;
    api_key?: string;
    model?: string;
    prompt?: string;
  };
  refresh_account_interval_minute?: number | string;
  image_retention_days?: number | string;
  image_poll_timeout_secs?: number | string;
  image_account_concurrency?: number | string;
  image_parallel_generation?: boolean;
  image_settle_enabled?: boolean;
  image_check_before_hit_enabled?: boolean;
  image_settle_secs?: number | string;
  image_timeout_retry_secs?: number | string;
  auto_remove_invalid_accounts?: boolean;
  auto_remove_rate_limited_accounts?: boolean;
  auto_relogin_after_refresh?: boolean;
  log_levels?: string[];
  image_storage?: ImageStorageSettings;
  proxy_runtime?: ProxyRuntimeSettings;
  third_party_apps?: ThirdPartyAppsSettings;
  backup?: BackupSettings;
  backup_state?: BackupState;
  [key: string]: unknown;
};

export type WalletInfo = {
  user_id: string;
  name: string;
  invite_code?: string;
  invited_by?: string;
  invited_by_email?: string;
  invited_count?: number;
  invited_users?: Array<Record<string, unknown>>;
  balance_cents: number;
  total_recharge_cents: number;
  total_consume_cents: number;
  agency_tier?: string;
  agency_enabled?: boolean;
  agency_commission_bp?: number;
  agency_discount_bp?: number;
  agency_joined_at?: string;
  subscription_tier?: string;
  subscription_start_at?: string;
  subscription_expire_at?: string;
  subscription_active?: boolean;
  updated_at?: string;
};

export type PayType = "alipay" | "wxpay" | "paypal" | "usdt" | "balance";

export type PayOrder = {
  id: string;
  record_type?: string;
  type?: string;
  order_kind?: string;
  provider: string;
  status: string;
  out_trade_no?: string;
  user_id?: string;
  user_display?: string;
  pay_type?: string;
  amount_cents: number;
  amount_yuan?: string;
  balance_after_cents?: number;
  note?: string;
  pay_url?: string;
  agency_tier?: string;
  subscription_tier?: string;
  created_at: string;
  updated_at?: string;
  paid_at?: string;
};

export type RedeemCode = {
  code: string;
  amount_cents: number;
  amount_yuan: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  used_by?: string;
  used_at?: string;
  note?: string;
};

export type AdminBillingStats = {
  today_revenue_cents: number;
  today_revenue_yuan: string;
  today_paid_count: number;
  total_revenue_cents: number;
  total_revenue_yuan: string;
  total_paid_count: number;
  pending_count: number;
  failed_count: number;
  record_count: number;
  updated_at?: string;
};

export type AgencyTier = {
  key: string;
  name: string;
  price_cents: number;
  price_yuan?: number;
  description?: string;
  commission_bp?: number;
  discount_bp?: number;
};

export type AgencyMaterial = {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  copy?: string;
};

export type AgencyMaterialQRConfig = {
  enabled?: boolean;
  x_percent?: number;
  y_percent?: number;
  size_percent?: number;
  logo_percent?: number;
};

export type AgencyConfig = {
  editable: boolean;
  enabled?: boolean;
  tiers: AgencyTier[];
  materials?: AgencyMaterial[];
  material_qr?: AgencyMaterialQRConfig;
};

export type AgencyCommissionOrder = {
  id: string;
  user_id?: string;
  user_email?: string;
  amount_cents: number;
  amount_yuan?: string;
  commission_cents: number;
  commission_yuan?: string;
  commission_bp?: number;
  status?: string;
  created_at?: string;
  out_trade_no?: string;
};

export type AgencyWithdrawalRequest = {
  id: string;
  user_id?: string;
  user_email?: string;
  amount_cents: number;
  amount_yuan?: string;
  alipay_qr_code?: string;
  wechat_qr_code?: string;
  phone?: string;
  wechat_id?: string;
  status?: "pending" | "approved" | "rejected" | "paid" | string;
  admin_note?: string;
  created_at?: string;
  updated_at?: string;
  processed_at?: string;
};

export type AgencyWithdrawProfile = {
  alipay_qr_code?: string;
  wechat_qr_code?: string;
  phone?: string;
  wechat_id?: string;
};

export type AgencyCommissionDashboard = {
  agent: {
    user_id: string;
    email?: string;
    name?: string;
    tier?: string;
    enabled?: boolean;
    commission_bp?: number;
    discount_bp?: number;
    joined_at?: string;
    invite_code?: string;
    channel_link?: string;
    invited_count?: number;
    invited_users?: Array<Record<string, unknown>>;
    wallet_balance?: number;
  };
  summary: {
    today_commission_cents: number;
    today_commission_yuan: string;
    month_commission_cents: number;
    month_commission_yuan: string;
    total_commission_cents: number;
    total_commission_yuan: string;
    available_cents: number;
    available_yuan: string;
  };
  orders: AgencyCommissionOrder[];
  withdrawals?: AgencyWithdrawalRequest[];
};

export type AgencyAdminUser = {
  id: string;
  email?: string;
  name?: string;
  agency_tier?: string;
  agency_enabled?: boolean;
  agency_commission_bp?: number;
  agency_discount_bp?: number;
  agency_joined_at?: string;
};

export type PermissionMenu = {
  id: string;
  label: string;
  path: string;
  order?: number;
  children?: PermissionMenu[];
};

export type ApiPermission = {
  key: string;
  method: string;
  path: string;
  label: string;
  group: string;
};

export type ManagedRole = {
  id: string;
  name: string;
  description?: string;
  builtin?: boolean;
  agency_tier?: string;
  subscription_tier?: string;
  menu_paths?: string[];
  api_permissions?: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type ManagedUser = {
  id: string;
  username?: string;
  email?: string;
  name: string;
  role: "user";
  role_id?: string;
  role_name?: string;
  provider?: string;
  enabled: boolean;
  has_api_key?: boolean;
  has_session?: boolean;
  api_key_id?: string;
  api_key_name?: string;
  credential_count?: number;
  created_at?: string | null;
  last_used_at?: string | null;
  menu_paths?: string[];
  api_permissions?: string[];
  balance_cents?: number;
  total_recharge_cents?: number;
  total_consume_cents?: number;
  agency_tier?: string;
  agency_enabled?: boolean;
  agency_commission_bp?: number;
  agency_discount_bp?: number;
  subscription_tier?: string;
  subscription_start_at?: string;
  subscription_expire_at?: string;
  subscription_active?: boolean;
};

export type SubscriptionPlan = {
  key: string;
  name: string;
  description?: string;
  badge?: string;
  price_cents: number;
  price_note?: string;
  features?: string[];
  period_label?: string;
};

export type SubscriptionStatus = {
  tier?: string;
  start_at?: string;
  expire_at?: string;
  active: boolean;
};

export type SubscriptionPlansResponse = {
  enabled?: boolean;
  plans: SubscriptionPlan[];
  status: SubscriptionStatus;
  wallet: WalletInfo;
  pay_channels?: string[];
  heading?: string;
  subheading?: string;
  safety_text?: string;
  agent_hint?: string;
};

export type BackupInclude = {
  config: boolean;
  register: boolean;
  cpa: boolean;
  sub2api: boolean;
  logs: boolean;
  image_tasks: boolean;
  accounts_snapshot: boolean;
  auth_keys_snapshot: boolean;
  images: boolean;
};

export type BackupSettings = {
  enabled: boolean;
  provider: "cloudflare_r2" | string;
  account_id: string;
  access_key_id: string;
  secret_access_key: string;
  bucket: string;
  prefix: string;
  interval_minutes: number | string;
  rotation_keep: number | string;
  encrypt: boolean;
  passphrase: string;
  include: BackupInclude;
};

export type BackupState = {
  running: boolean;
  last_started_at?: string | null;
  last_finished_at?: string | null;
  last_status?: string;
  last_error?: string | null;
  last_object_key?: string | null;
};

export type BackupItem = {
  key: string;
  name: string;
  size: number;
  updated_at?: string | null;
  encrypted: boolean;
};

export type BackupDetail = {
  key: string;
  name: string;
  encrypted: boolean;
  created_at?: string | null;
  trigger?: string | null;
  app_version?: string | null;
  storage_backend?: Record<string, unknown> | null;
  files: Array<{
    name: string;
    exists: boolean;
    content_type?: string;
    size: number;
    sha256?: string;
  }>;
  snapshots: Array<{
    name: string;
    count: number;
  }>;
};

export type ManagedImage = {
  rel: string;
  path?: string;
  name: string;
  date: string;
  size: number;
  url: string;
  thumbnail_url?: string;
  created_at: string;
  width?: number;
  height?: number;
  tags?: string[];
};

export type SystemLog = {
  id: string;
  time: string;
  type: "call" | "account" | string;
  summary?: string;
  detail?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ImageResponse = {
  created: number;
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
};

export type ImageTask = {
  id: string;
  status: "queued" | "running" | "success" | "error";
  mode: "generate" | "edit";
  model?: ImageModel;
  size?: string;
  quality?: string;
  created_at: string;
  updated_at: string;
  conversation_id?: string;
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  error?: string;
  progress?: string;
  elapsed_secs?: number;
  duration_ms?: number;
};

type ImageTaskListResponse = {
  items: ImageTask[];
  missing_ids: string[];
};

export type LoginResponse = {
  ok: boolean;
  version: string;
  role: AuthRole;
  role_id?: string;
  role_name?: string;
  subject_id: string;
  name: string;
  menu_paths?: string[];
  api_permissions?: string[];
  key?: string;
};

export type AppMeta = {
  app_title: string;
  project_name: string;
  top_left_logo_url: string;
  site_logo_url: string;
  agency_enabled?: boolean;
  subscription_enabled?: boolean;
};

export type UserKey = {
  id: string;
  name: string;
  role: "user";
  enabled: boolean;
  created_at: string | null;
  last_used_at: string | null;
};

export type OutlookPoolStats = {
  unused: number;
  in_use: number;
  used: number;
  token_invalid: number;
  failed: number;
};

export type RegisterConfig = {
  enabled: boolean;
  mail: {
    request_timeout: number;
    wait_timeout: number;
    wait_interval: number;
    providers: Array<Record<string, unknown>>;
  };
  proxy: string;
  total: number;
  threads: number;
  mode: "total" | "quota" | "available";
  target_quota: number;
  target_available: number;
  check_interval: number;
  stats: {
    job_id?: string;
    success: number;
    fail: number;
    done: number;
    running: number;
    threads: number;
    elapsed_seconds?: number;
    avg_seconds?: number;
    success_rate?: number;
    current_quota?: number;
    current_available?: number;
    started_at?: string;
    updated_at?: string;
    finished_at?: string;
  };
  logs?: Array<{
    time: string;
    text: string;
    level: string;
  }>;
};

export async function login(authKey: string) {
  const normalizedAuthKey = String(authKey || "").trim();
  return httpRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: {},
    headers: {
      Authorization: `Bearer ${normalizedAuthKey}`,
    },
    redirectOnUnauthorized: false,
  });
}

export async function fetchAccounts() {
  return httpRequest<AccountListResponse>("/api/accounts");
}

export async function fetchModels() {
  return httpRequest<ModelListResponse>("/v1/models");
}

export async function createAccounts(tokens: string[], accounts: AccountImportPayload[] = []) {
  return httpRequest<AccountMutationResponse>("/api/accounts", {
    method: "POST",
    body: { tokens, accounts },
  });
}

export type OAuthLoginStartResponse = {
  session_id: string;
  authorize_url: string;
  expires_in: string;
  redirect_uri_prefix: string;
};

export async function startOAuthLogin(emailHint?: string) {
  return httpRequest<OAuthLoginStartResponse>("/api/accounts/oauth/start", {
    method: "POST",
    body: { email_hint: emailHint ?? "" },
  });
}

export async function finishOAuthLogin(sessionId: string, callback: string) {
  return httpRequest<AccountMutationResponse>("/api/accounts/oauth/finish", {
    method: "POST",
    body: { session_id: sessionId, callback },
  });
}

export async function deleteAccounts(tokens: string[]) {
  return httpRequest<AccountMutationResponse>("/api/accounts", {
    method: "DELETE",
    body: { tokens },
  });
}

export async function refreshAccounts(accessTokens: string[]) {
  return httpRequest<{ progress_id: string }>("/api/accounts/refresh", {
    method: "POST",
    body: { access_tokens: accessTokens },
  });
}

export async function fetchRefreshProgress(progressId: string) {
  return httpRequest<RefreshProgressResponse>(`/api/accounts/refresh/progress/${progressId}`);
}

export async function reLoginAccounts(accessTokens: string[]) {
  return httpRequest<{ progress_id: string }>("/api/accounts/re-login", {
    method: "POST",
    body: { access_tokens: accessTokens },
  });
}

export async function fetchReLoginProgress(progressId: string) {
  return httpRequest<RefreshProgressResponse>(`/api/accounts/re-login/progress/${progressId}`);
}

export async function updateAccount(
  accessToken: string,
  updates: {
    type?: AccountType;
    status?: AccountStatus;
    quota?: number;
    proxy?: string;
  },
) {
  return httpRequest<AccountUpdateResponse>("/api/accounts/update", {
    method: "POST",
    body: {
      access_token: accessToken,
      ...updates,
    },
  });
}

export async function generateImage(prompt: string, model?: ImageModel, size?: string, quality = "auto") {
  return httpRequest<ImageResponse>(
    "/v1/images/generations",
    {
      method: "POST",
      body: {
        prompt,
        ...(model ? { model } : {}),
        ...(size ? { size } : {}),
        quality,
        n: 1,
        response_format: "b64_json",
      },
    },
  );
}

export async function editImage(files: File | File[], prompt: string, model?: ImageModel, size?: string, quality = "auto") {
  const formData = new FormData();
  const uploadFiles = Array.isArray(files) ? files : [files];

  uploadFiles.forEach((file) => {
    formData.append("image", file);
  });
  formData.append("prompt", prompt);
  if (model) {
    formData.append("model", model);
  }
  if (size) {
    formData.append("size", size);
  }
  formData.append("quality", quality);
  formData.append("n", "1");

  return httpRequest<ImageResponse>(
    "/v1/images/edits",
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function createImageGenerationTask(clientTaskId: string, prompt: string, model?: ImageModel, size?: string, quality = "auto") {
  return httpRequest<ImageTask>("/api/image-tasks/generations", {
    method: "POST",
    body: {
      client_task_id: clientTaskId,
      prompt,
      ...(model ? { model } : {}),
      ...(size ? { size } : {}),
      quality,
    },
  });
}

export async function createImageEditTask(
  clientTaskId: string,
  files: File | File[],
  prompt: string,
  model?: ImageModel,
  size?: string,
  quality = "auto",
) {
  const formData = new FormData();
  const uploadFiles = Array.isArray(files) ? files : [files];

  uploadFiles.forEach((file) => {
    formData.append("image", file);
  });
  formData.append("client_task_id", clientTaskId);
  formData.append("prompt", prompt);
  if (model) {
    formData.append("model", model);
  }
  if (size) {
    formData.append("size", size);
  }
  formData.append("quality", quality);

  return httpRequest<ImageTask>("/api/image-tasks/edits", {
    method: "POST",
    body: formData,
  });
}

export async function fetchImageTasks(ids: string[]) {
  const params = new URLSearchParams();
  if (ids.length > 0) {
    params.set("ids", ids.join(","));
  }
  params.set("_t", String(Date.now()));
  return httpRequest<ImageTaskListResponse>(`/api/image-tasks?${params.toString()}`);
}

export async function resumeImagePoll(taskId: string, extraTimeoutSecs = 30) {
  return httpRequest<ImageTask>(`/api/image-tasks/${encodeURIComponent(taskId)}/resume-poll`, {
    method: "POST",
    body: { extra_timeout_secs: extraTimeoutSecs },
  });
}

export async function fetchSettingsConfig() {
  return httpRequest<{ config: SettingsConfig }>("/api/settings");
}

export async function fetchAppMeta() {
  return httpRequest<AppMeta>("/api/app-meta", {
    redirectOnUnauthorized: false,
  });
}

export async function loginWithPassword(payload: { email: string; password: string }) {
  return httpRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: payload,
    redirectOnUnauthorized: false,
  });
}

export async function fetchAuthProviders() {
  return httpRequest<{
    key_login?: { enabled: boolean };
    registration?: { enabled: boolean };
    email_verification?: { enabled: boolean };
  }>("/auth/providers", {
    redirectOnUnauthorized: false,
  });
}

export async function sendRegisterCode(email: string) {
  return httpRequest<{ ok: boolean; expires_in?: number }>("/auth/register/send-code", {
    method: "POST",
    body: { email },
    redirectOnUnauthorized: false,
  });
}

export async function registerEmailAccount(email: string, password: string, code: string, name?: string) {
  return httpRequest<LoginResponse>("/auth/register", {
    method: "POST",
    body: {
      email,
      password,
      code,
      name: name ?? "",
    },
    redirectOnUnauthorized: false,
  });
}

export async function updateSettingsConfig(settings: SettingsConfig) {
  return httpRequest<{ config: SettingsConfig }>("/api/settings", {
    method: "POST",
    body: settings,
  });
}

export async function fetchThirdPartyApps() {
  return httpRequest<{ third_party_apps: ThirdPartyAppsSettings }>("/api/third-party-apps");
}

export async function fetchPermissionCatalog() {
  return httpRequest<{ menus: PermissionMenu[]; apis: ApiPermission[] }>("/api/admin/permissions");
}

export async function fetchManagedRoles() {
  return httpRequest<{ items: ManagedRole[] }>("/api/admin/roles");
}

export async function createManagedRole(payload: {
  name: string;
  description?: string;
  agency_tier?: string;
  subscription_tier?: string;
  menu_paths?: string[];
  api_permissions?: string[];
}) {
  return httpRequest<{ item: ManagedRole; items: ManagedRole[] }>("/api/admin/roles", {
    method: "POST",
    body: payload,
  });
}

export async function updateManagedRole(
  roleId: string,
  updates: {
    name?: string;
    description?: string;
    agency_tier?: string;
    subscription_tier?: string;
    menu_paths?: string[];
    api_permissions?: string[];
  },
) {
  return httpRequest<{ item: ManagedRole; items: ManagedRole[] }>(`/api/admin/roles/${encodeURIComponent(roleId)}`, {
    method: "POST",
    body: updates,
  });
}

export async function deleteManagedRole(roleId: string) {
  return httpRequest<{ items: ManagedRole[] }>(`/api/admin/roles/${encodeURIComponent(roleId)}`, {
    method: "DELETE",
  });
}

export async function fetchManagedUsers() {
  return httpRequest<{ items: ManagedUser[] }>("/api/admin/users");
}

export async function createManagedUser(payload: {
  username: string;
  name?: string;
  password: string;
  role_id?: string;
  enabled?: boolean;
}) {
  return httpRequest<{ item: ManagedUser; key: string; items: ManagedUser[] }>("/api/admin/users", {
    method: "POST",
    body: payload,
  });
}

export async function updateManagedUser(
  userId: string,
  updates: { enabled?: boolean; name?: string; role_id?: string },
) {
  return httpRequest<{ item: ManagedUser; items: ManagedUser[] }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "POST",
    body: updates,
  });
}

export async function deleteManagedUser(userId: string) {
  return httpRequest<{ items: ManagedUser[] }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function resetManagedUserKey(userId: string, name?: string) {
  return httpRequest<{ item: ManagedUser; api_key: Record<string, unknown>; key: string; items: ManagedUser[] }>(`/api/admin/users/${encodeURIComponent(userId)}/reset-key`, {
    method: "POST",
    body: { name: name ?? "" },
  });
}

export async function importLegacyData(sourcePath: string) {
  return httpRequest<{
    ok: boolean;
    roles_imported: number;
    users_imported: number;
    billing_profiles_imported: number;
    created_keys: Array<{ id: string; username: string; key: string }>;
  }>("/api/admin/import/legacy", {
    method: "POST",
    body: { source_path: sourcePath },
  });
}

export async function adjustManagedUserBalance(
  userId: string,
  payload: { delta_cents?: number; balance_cents?: number; note?: string },
) {
  return httpRequest<{ wallet: WalletInfo; items: WalletInfo[] }>(`/api/admin/billing/users/${encodeURIComponent(userId)}/balance`, {
    method: "POST",
    body: payload,
  });
}

export async function adjustManagedUserSubscription(
  userId: string,
  payload: {
    mode: "set" | "extend" | "clear";
    tier?: string;
    expire_at?: string;
    extend_days?: number;
  },
) {
  return httpRequest<{ status: SubscriptionStatus; items: WalletInfo[] }>(`/api/admin/billing/users/${encodeURIComponent(userId)}/subscription`, {
    method: "POST",
    body: payload,
  });
}

export async function fetchWallet() {
  return httpRequest<{ wallet: WalletInfo; image_price: number; pay_channels?: string[] }>("/api/wallet");
}

export async function redeemWalletCode(payload: { code: string }) {
  return httpRequest<{ ok: boolean; wallet: WalletInfo }>("/api/wallet/redeem", {
    method: "POST",
    body: payload,
  });
}

export async function fetchPayOrders(limit = 100) {
  return httpRequest<{ items: PayOrder[] }>(`/api/pay/orders?limit=${encodeURIComponent(String(limit))}`);
}

export async function createPayOrder(payload: {
  amount?: string;
  amount_cents?: number;
  pay_type: PayType;
}) {
  return httpRequest<{ order: PayOrder }>("/api/pay/orders", {
    method: "POST",
    body: payload,
  });
}

export async function fetchAdminBillingOrders(limit = 300) {
  return httpRequest<{ items: PayOrder[]; stats: AdminBillingStats }>(`/api/admin/billing/orders?limit=${encodeURIComponent(String(limit))}`);
}

export async function fetchAdminBillingUsers() {
  return httpRequest<{ items: WalletInfo[] }>("/api/admin/billing/users");
}

export async function fetchRedeemCodes(limit = 200) {
  return httpRequest<{ items: RedeemCode[] }>(`/api/admin/billing/redeem-codes?limit=${encodeURIComponent(String(limit))}`);
}

export async function createRedeemCodes(payload: {
  amount_cents?: number;
  amount?: string;
  count?: number;
  expires_at?: string;
  note?: string;
}) {
  return httpRequest<{ items: RedeemCode[]; created: RedeemCode[] }>("/api/admin/billing/redeem-codes", {
    method: "POST",
    body: payload,
  });
}

export async function updateRedeemCode(
  code: string,
  payload: { enabled?: boolean; expires_at?: string; note?: string },
) {
  return httpRequest<{ item: RedeemCode; items: RedeemCode[] }>(`/api/admin/billing/redeem-codes/${encodeURIComponent(code)}`, {
    method: "POST",
    body: payload,
  });
}

export async function deleteRedeemCode(code: string) {
  return httpRequest<{ items: RedeemCode[] }>(`/api/admin/billing/redeem-codes/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
}

export async function fetchAgencyConfig() {
  return httpRequest<AgencyConfig>("/api/agency");
}

export async function updateAgencyConfig(payload: Record<string, unknown>) {
  return httpRequest<{ config: SettingsConfig }>("/api/agency", {
    method: "POST",
    body: payload,
  });
}

export async function joinAgencyTier(payload: { tier: string; pay_type: PayType }) {
  return httpRequest<{ ok: boolean; pending_payment: boolean; tier: string; order: PayOrder }>("/api/agency/join", {
    method: "POST",
    body: payload,
  });
}

export async function upgradeAgencyTier(payload: { tier: string; pay_type: PayType }) {
  return httpRequest<{ ok: boolean; pending_payment: boolean; tier: string; order: PayOrder }>("/api/agency/upgrade", {
    method: "POST",
    body: payload,
  });
}

export async function fetchAgencyCommissionDashboard() {
  return httpRequest<AgencyCommissionDashboard>("/api/agency/commission");
}

export async function fetchAgencyWithdrawals(limit = 100) {
  return httpRequest<{ items: AgencyWithdrawalRequest[] }>(`/api/agency/withdrawals?limit=${encodeURIComponent(String(limit))}`);
}

export async function createAgencyWithdrawal(payload: {
  amount_cents: number;
  alipay_qr_code?: string;
  wechat_qr_code?: string;
  phone?: string;
  wechat_id?: string;
}) {
  return httpRequest<{ ok: boolean; item: AgencyWithdrawalRequest }>("/api/agency/withdrawals", {
    method: "POST",
    body: payload,
  });
}

export async function fetchAgencyWithdrawProfile() {
  return httpRequest<{ profile: AgencyWithdrawProfile }>("/api/agency/withdraw-profile");
}

export async function updateAgencyWithdrawProfile(payload: AgencyWithdrawProfile) {
  return httpRequest<{ ok: boolean; profile: AgencyWithdrawProfile }>("/api/agency/withdraw-profile", {
    method: "POST",
    body: payload,
  });
}

export async function fetchAgencyAdminUsers() {
  return httpRequest<{ items: AgencyAdminUser[] }>("/api/agency/admin/users");
}

export async function activateAgencyUser(payload: { user_id: string; tier: string }) {
  return httpRequest<{ ok: boolean; wallet?: Record<string, unknown>; tier: string }>("/api/agency/admin/users", {
    method: "POST",
    body: payload,
  });
}

export async function fetchAgencyAdminWithdrawals(limit = 500) {
  return httpRequest<{ items: AgencyWithdrawalRequest[] }>(`/api/agency/admin/withdrawals?limit=${encodeURIComponent(String(limit))}`);
}

export async function updateAgencyAdminWithdrawal(payload: {
  id: string;
  status: "pending" | "approved" | "paid" | "rejected";
  admin_note?: string;
}) {
  return httpRequest<{ ok: boolean; item: AgencyWithdrawalRequest }>("/api/agency/admin/withdrawals", {
    method: "POST",
    body: payload,
  });
}

export async function fetchSubscriptionPlans() {
  return httpRequest<SubscriptionPlansResponse>("/api/subscriptions/plans");
}

export async function createSubscriptionOrder(payload: { tier: string; pay_type: PayType }) {
  return httpRequest<{ ok: boolean; pending_payment: boolean; tier: string; order: PayOrder }>("/api/subscriptions/orders", {
    method: "POST",
    body: payload,
  });
}

export async function testBackupConnection() {
  return httpRequest<{ result: { ok: boolean; status: number } }>("/api/backup/test", {
    method: "POST",
    body: {},
  });
}

export async function testImageStorageConnection() {
  return httpRequest<{ result: { ok: boolean; status: number; error?: string } }>("/api/image-storage/test", {
    method: "POST",
    body: {},
  });
}

export async function syncImageStorage() {
  return httpRequest<{ result: { uploaded: number; skipped: number; failed: number } }>("/api/image-storage/sync", {
    method: "POST",
    body: {},
  });
}

export async function fetchBackups() {
  return httpRequest<{ items: BackupItem[]; state: BackupState; settings: BackupSettings }>("/api/backups");
}

export async function runBackupNow() {
  return httpRequest<{ result: { key: string; size: number; encrypted: boolean } }>("/api/backups/run", {
    method: "POST",
    body: {},
  });
}

export async function deleteBackup(key: string) {
  return httpRequest<{ ok: boolean }>("/api/backups/delete", {
    method: "POST",
    body: { key },
  });
}

export async function fetchBackupDetail(key: string) {
  const params = new URLSearchParams();
  params.set("key", key);
  return httpRequest<{ item: BackupDetail }>(`/api/backups/detail?${params.toString()}`);
}

export function getBackupDownloadUrl(key: string) {
  const params = new URLSearchParams();
  params.set("key", key);
  return `/api/backups/download?${params.toString()}`;
}

export async function fetchManagedImages(filters: { start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  return httpRequest<{ items: ManagedImage[]; groups: Array<{ date: string; items: ManagedImage[] }> }>(
    `/api/images${params.toString() ? `?${params.toString()}` : ""}`,
  );
}

export async function deleteManagedImages(body: { paths?: string[]; start_date?: string; end_date?: string; all_matching?: boolean }) {
  return httpRequest<{ removed: number }>("/api/images/delete", { method: "POST", body });
}

export async function downloadImages(paths: string[]) {
  const response = await request.post("/api/images/download", { paths }, { responseType: "blob" });
  const blob = response.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "images.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadSingleImage(path: string) {
  const response = await request.get(`/api/images/download/${path}`, { responseType: "blob" });
  const blob = response.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = path.split("/").pop() || "image.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchImageTags() {
  return httpRequest<{ tags: string[] }>("/api/images/tags");
}

export async function setImageTags(path: string, tags: string[]) {
  return httpRequest<{ ok: boolean; tags: string[] }>("/api/images/tags", {
    method: "POST",
    body: { path, tags },
  });
}

export async function deleteImageTag(tag: string) {
  return httpRequest<{ ok: boolean; removed_from: number }>(`/api/images/tags/${encodeURIComponent(tag)}`, {
    method: "DELETE",
  });
}

export type ImageStorageStats = {
  disk_total_mb: number; disk_used_mb: number; disk_free_mb: number;
  image_count: number; image_size_mb: number; image_size_bytes: number;
};

export async function fetchImageStorage() {
  return httpRequest<ImageStorageStats>("/api/images/storage");
}

export async function compressAllImages() {
  return httpRequest<{ compressed: number; saved_bytes: number; saved_mb: number }>("/api/images/storage/compress", { method: "POST" });
}

export async function deleteToTarget(targetFreeMb: number) {
  return httpRequest<{ removed: number; freed_mb: number; done: boolean }>(
    `/api/images/storage/cleanup-to-target?target_free_mb=${targetFreeMb}&dry_run=false`,
    { method: "POST" },
  );
}

export async function fetchSystemLogs(filters: { type?: string; start_date?: string; end_date?: string }) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  return httpRequest<{ items: SystemLog[] }>(`/api/logs${params.toString() ? `?${params.toString()}` : ""}`);
}

export async function deleteSystemLogs(ids: string[]) {
  return httpRequest<{ removed: number }>("/api/logs/delete", {
    method: "POST",
    body: { ids },
  });
}

export async function fetchUserKeys() {
  return httpRequest<{ items: UserKey[] }>("/api/auth/users");
}

export async function createUserKey(name: string) {
  return httpRequest<{ item: UserKey; key: string; items: UserKey[] }>("/api/auth/users", {
    method: "POST",
    body: { name },
  });
}

export async function updateUserKey(keyId: string, updates: { enabled?: boolean; name?: string; key?: string }) {
  return httpRequest<{ item: UserKey; items: UserKey[] }>(`/api/auth/users/${keyId}`, {
    method: "POST",
    body: updates,
  });
}

export async function deleteUserKey(keyId: string) {
  return httpRequest<{ items: UserKey[] }>(`/api/auth/users/${keyId}`, {
    method: "DELETE",
  });
}

export async function fetchRegisterConfig() {
  return httpRequest<{ register: RegisterConfig }>("/api/register");
}

export async function updateRegisterConfig(updates: Partial<RegisterConfig>) {
  return httpRequest<{ register: RegisterConfig }>("/api/register", {
    method: "POST",
    body: updates,
  });
}

export async function startRegister() {
  return httpRequest<{ register: RegisterConfig }>("/api/register/start", { method: "POST" });
}

export async function stopRegister() {
  return httpRequest<{ register: RegisterConfig }>("/api/register/stop", { method: "POST" });
}

export async function resetRegister() {
  return httpRequest<{ register: RegisterConfig }>("/api/register/reset", { method: "POST" });
}

export async function resetOutlookPool(scope: "all" | "failed" | "unused" = "all") {
  return httpRequest<{ register: RegisterConfig }>("/api/register/outlook-pool/reset", {
    method: "POST",
    body: { scope },
  });
}

// ── CPA (CLIProxyAPI) ──────────────────────────────────────────────

export type CPAPool = {
  id: string;
  name: string;
  base_url: string;
  import_job?: CPAImportJob | null;
};

export type CPARemoteFile = {
  name: string;
  email: string;
};

export type CPAImportJob = {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  updated_at: string;
  total: number;
  completed: number;
  added: number;
  skipped: number;
  refreshed: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
};

export async function fetchCPAPools() {
  return httpRequest<{ pools: CPAPool[] }>("/api/cpa/pools");
}

export async function createCPAPool(pool: { name: string; base_url: string; secret_key: string }) {
  return httpRequest<{ pool: CPAPool; pools: CPAPool[] }>("/api/cpa/pools", {
    method: "POST",
    body: pool,
  });
}

export async function updateCPAPool(
  poolId: string,
  updates: { name?: string; base_url?: string; secret_key?: string },
) {
  return httpRequest<{ pool: CPAPool; pools: CPAPool[] }>(`/api/cpa/pools/${poolId}`, {
    method: "POST",
    body: updates,
  });
}

export async function deleteCPAPool(poolId: string) {
  return httpRequest<{ pools: CPAPool[] }>(`/api/cpa/pools/${poolId}`, {
    method: "DELETE",
  });
}

export async function fetchCPAPoolFiles(poolId: string) {
  return httpRequest<{ pool_id: string; files: CPARemoteFile[] }>(`/api/cpa/pools/${poolId}/files`);
}

export async function startCPAImport(poolId: string, names: string[]) {
  return httpRequest<{ import_job: CPAImportJob | null }>(`/api/cpa/pools/${poolId}/import`, {
    method: "POST",
    body: { names },
  });
}

export async function fetchCPAPoolImportJob(poolId: string) {
  return httpRequest<{ import_job: CPAImportJob | null }>(`/api/cpa/pools/${poolId}/import`);
}

// ── Sub2API ────────────────────────────────────────────────────────

export type Sub2APIServer = {
  id: string;
  name: string;
  base_url: string;
  email: string;
  has_api_key: boolean;
  group_id: string;
  import_job?: CPAImportJob | null;
};

export type Sub2APIRemoteAccount = {
  id: string;
  name: string;
  email: string;
  plan_type: string;
  status: string;
  expires_at: string;
  has_refresh_token: boolean;
};

export type Sub2APIRemoteGroup = {
  id: string;
  name: string;
  description: string;
  platform: string;
  status: string;
  account_count: number;
  active_account_count: number;
};

export async function fetchSub2APIServers() {
  return httpRequest<{ servers: Sub2APIServer[] }>("/api/sub2api/servers");
}

export async function createSub2APIServer(server: {
  name: string;
  base_url: string;
  email: string;
  password: string;
  api_key: string;
  group_id: string;
}) {
  return httpRequest<{ server: Sub2APIServer; servers: Sub2APIServer[] }>("/api/sub2api/servers", {
    method: "POST",
    body: server,
  });
}

export async function updateSub2APIServer(
  serverId: string,
  updates: {
    name?: string;
    base_url?: string;
    email?: string;
    password?: string;
    api_key?: string;
    group_id?: string;
  },
) {
  return httpRequest<{ server: Sub2APIServer; servers: Sub2APIServer[] }>(`/api/sub2api/servers/${serverId}`, {
    method: "POST",
    body: updates,
  });
}

export async function fetchSub2APIServerGroups(serverId: string) {
  return httpRequest<{ server_id: string; groups: Sub2APIRemoteGroup[] }>(
    `/api/sub2api/servers/${serverId}/groups`,
  );
}

export async function deleteSub2APIServer(serverId: string) {
  return httpRequest<{ servers: Sub2APIServer[] }>(`/api/sub2api/servers/${serverId}`, {
    method: "DELETE",
  });
}

export async function fetchSub2APIServerAccounts(serverId: string) {
  return httpRequest<{ server_id: string; accounts: Sub2APIRemoteAccount[] }>(
    `/api/sub2api/servers/${serverId}/accounts`,
  );
}

export async function startSub2APIImport(serverId: string, accountIds: string[]) {
  return httpRequest<{ import_job: CPAImportJob | null }>(`/api/sub2api/servers/${serverId}/import`, {
    method: "POST",
    body: { account_ids: accountIds },
  });
}

export async function fetchSub2APIImportJob(serverId: string) {
  return httpRequest<{ import_job: CPAImportJob | null }>(`/api/sub2api/servers/${serverId}/import`);
}

// ── Upstream proxy ────────────────────────────────────────────────

export type ProxySettings = {
  enabled: boolean;
  url: string;
};

export type ProxyTestResult = {
  ok: boolean;
  status: number;
  latency_ms: number;
  error: string | null;
  proxy_source?: string;
  has_proxy?: boolean;
};

export type ClearanceTestResult = {
  ok: boolean;
  status: string;
  latency_ms: number;
  has_cookies: boolean;
  user_agent: string;
  error: string | null;
  runtime: ProxyRuntimeStatus;
};

export async function fetchProxy() {
  return httpRequest<{ proxy: ProxySettings }>("/api/proxy");
}

export async function updateProxy(updates: { enabled?: boolean; url?: string }) {
  return httpRequest<{ proxy: ProxySettings }>("/api/proxy", {
    method: "POST",
    body: updates,
  });
}

export async function testProxy(url?: string) {
  return httpRequest<{ result: ProxyTestResult }>("/api/proxy/test", {
    method: "POST",
    body: { url: url ?? "" },
  });
}

export async function fetchProxyRuntime() {
  return httpRequest<ProxyRuntimeResponse>("/api/proxy/runtime");
}

export async function updateProxyRuntime(runtime: ProxyRuntimeSettings) {
  return httpRequest<ProxyRuntimeResponse>("/api/proxy/runtime", {
    method: "POST",
    body: runtime,
  });
}

export async function testProxyClearance(targetUrl?: string) {
  return httpRequest<{ result: ClearanceTestResult }>("/api/proxy/clearance/test", {
    method: "POST",
    body: { target_url: targetUrl ?? "https://chatgpt.com" },
  });
}

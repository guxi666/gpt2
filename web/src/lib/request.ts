import axios, { AxiosError, type AxiosRequestConfig } from "axios";

import webConfig from "@/constants/common-env";
import { clearStoredAuthSession, getStoredAuthKey } from "@/store/auth";

type RequestConfig = AxiosRequestConfig & {
  redirectOnUnauthorized?: boolean;
  __retriedCloudflareEdge?: boolean;
};

type ErrorPayload = {
  detail?: string | { error?: string | { message?: string } };
  error?: string | { message?: string };
  message?: string;
};

const CLOUDFLARE_EDGE_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526]);
const CLOUDFLARE_EDGE_PATTERNS = [
  "the origin web server returned an invalid or incomplete response to cloudflare",
  "error code 520",
  "error code 521",
  "error code 522",
  "error code 523",
  "error code 524",
  "error code 525",
  "error code 526",
  "cf-ray",
];

function errorMessageFromValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }

  const item = value as { error?: unknown; message?: unknown };
  if (typeof item.message === "string") {
    return item.message;
  }
  return errorMessageFromValue(item.error);
}

function responseTextFromPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const payload = value as ErrorPayload;
  return [
    errorMessageFromValue(payload.detail),
    errorMessageFromValue(payload.error),
    payload.message || "",
  ]
    .filter(Boolean)
    .join(" ");
}

function isCloudflareEdgeError(status: number | undefined, payload: unknown, message: string) {
  if (status && CLOUDFLARE_EDGE_STATUSES.has(status)) {
    return true;
  }
  const haystack = `${responseTextFromPayload(payload)} ${message}`.toLowerCase();
  return CLOUDFLARE_EDGE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function isRetryableMethod(method?: string) {
  const normalized = String(method || "GET").trim().toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const request = axios.create({
  baseURL: webConfig.apiUrl.replace(/\/$/, ""),
});

request.interceptors.request.use(async (config) => {
  const nextConfig = { ...config };
  const authKey = await getStoredAuthKey();
  const headers = { ...(nextConfig.headers || {}) } as Record<string, string>;
  if (authKey && !headers.Authorization) {
    headers.Authorization = `Bearer ${authKey}`;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  nextConfig.headers = headers;
  return nextConfig;
});

request.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorPayload>) => {
    const status = error.response?.status;
    const requestConfig = error.config as RequestConfig | undefined;
    const shouldRedirect = requestConfig?.redirectOnUnauthorized !== false;
    if (status === 401 && shouldRedirect && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/login")) {
        await clearStoredAuthSession();
        window.location.replace("/login");
        return new Promise(() => {});
      }
    }

    const payload = error.response?.data;
    const upstreamMessage =
      errorMessageFromValue(payload?.detail) ||
      errorMessageFromValue(payload?.error) ||
      payload?.message ||
      error.message ||
      `请求失败 (${status || 500})`;

    if (
      requestConfig &&
      !requestConfig.__retriedCloudflareEdge &&
      isRetryableMethod(requestConfig.method) &&
      isCloudflareEdgeError(status, payload, upstreamMessage)
    ) {
      requestConfig.__retriedCloudflareEdge = true;
      await sleep(400);
      return request.request(requestConfig);
    }

    if (isCloudflareEdgeError(status, payload, upstreamMessage)) {
      return Promise.reject(new Error("源站连接暂时不稳定，请稍后重试"));
    }

    return Promise.reject(new Error(upstreamMessage));
  },
);

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  redirectOnUnauthorized?: boolean;
};

export async function httpRequest<T>(path: string, options: RequestOptions = {}) {
  const { method = "GET", body, headers, redirectOnUnauthorized = true } = options;
  const config: RequestConfig = {
    url: path,
    method,
    data: body,
    headers,
    redirectOnUnauthorized,
  };
  const response = await request.request<T>(config);
  return response.data;
}

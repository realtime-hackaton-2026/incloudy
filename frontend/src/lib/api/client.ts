// Cliente HTTP base para consumir la API de incloudy (FastAPI).
// Centraliza: URL base, token JWT, parseo de errores y de respuestas vacías.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || "http://localhost:8000";

const TOKEN_KEY = "incloudy:token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage puede fallar en modo privado/SSR; la sesión simplemente
    // no persistirá entre recargas.
  }
}

/**
 * Error tipado para respuestas no-2xx de la API. `detail` conserva el
 * mensaje que envía FastAPI (por ejemplo "Email o contraseña incorrectos").
 */
export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `Error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  auth?: boolean; // añade el header Authorization (por defecto true)
  signal?: AbortSignal;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // 204 No Content (p.ej. DELETE) no trae cuerpo.
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? data.detail : data;
    throw new ApiError(response.status, detail);
  }

  return data as T;
}

/**
 * Variante de apiRequest para endpoints que esperan
 * application/x-www-form-urlencoded (así es como FastAPI's
 * OAuth2PasswordRequestForm exige POST /auth/login, a diferencia del resto
 * de la API que usa JSON).
 */
export async function apiRequestForm<T>(path: string, form: Record<string, string>): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? data.detail : data;
    throw new ApiError(response.status, detail);
  }

  return data as T;
}

export { API_URL };

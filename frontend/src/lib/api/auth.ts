import { apiRequest, apiRequestForm, setToken } from "./client";
import type { RegisterRequest, TokenResponse } from "./types";

/** POST /auth/register — crea el profesor y guarda el token recibido. */
export async function register(body: RegisterRequest): Promise<TokenResponse> {
  const result = await apiRequest<TokenResponse>("/auth/register", {
    method: "POST",
    body,
    auth: false,
  });
  setToken(result.access_token);
  return result;
}

/**
 * POST /auth/login — OAuth2PasswordRequestForm exige form-urlencoded con
 * los campos "username" y "password" (username = email en este backend).
 */
export async function login(email: string, password: string): Promise<TokenResponse> {
  const result = await apiRequestForm<TokenResponse>("/auth/login", {
    username: email,
    password,
  });
  setToken(result.access_token);
  return result;
}

/** GET /auth/me — el backend devuelve el email autenticado como string plano. */
export async function me(): Promise<string> {
  return apiRequest<string>("/auth/me");
}

export function logout(): void {
  setToken(null);
}

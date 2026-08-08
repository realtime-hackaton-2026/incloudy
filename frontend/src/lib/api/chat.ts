import { apiRequest } from "./client";
import type { ChatRequest, ChatResponse } from "./types";

/** POST /chat — asistente Gemini, opcionalmente con contexto de un caso. */
export function sendChatMessage(mensaje: string, caseId?: string): Promise<ChatResponse> {
  const body: ChatRequest = { mensaje, case_id: caseId ?? null };
  return apiRequest<ChatResponse>("/chat", { method: "POST", body });
}

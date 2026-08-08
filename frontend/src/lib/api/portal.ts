import { apiRequest } from "./client";
import type { PortalSessionResponse } from "./types";

/**
 * POST /portal/sessions/{case_id} — pide al backend una sesión Portal
 * limitada al canal privado de ese caso (`case-{id}`). El backend nunca
 * expone PORTAL_SECRET_KEY; el resultado (`token`, `publishable_key`,
 * `channel_id`) es lo único que necesita el SDK de Portal en el cliente:
 *
 *   const session = await createPortalSession(caseId);
 *   const portal = new Portal({ apiKey: session.publishable_key });
 *   // <PortalProvider client={portal}> ... useChannel({ channelId: session.channel_id }) ...
 */
export function createPortalSession(caseId: string): Promise<PortalSessionResponse> {
  return apiRequest<PortalSessionResponse>(
    `/portal/sessions/${encodeURIComponent(caseId)}`,
    { method: "POST" }
  );
}

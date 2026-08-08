import { apiRequest } from "./client";
import type {
  Case,
  CaseCreate,
  CaseUpdate,
  CollaboratorRequest,
  CollaboratorResponse,
} from "./types";

/** GET /cases — casos propios y aquellos donde el profesor colabora. */
export function listCases(): Promise<Case[]> {
  return apiRequest<Case[]>("/cases");
}

/** POST /cases */
export function createCase(body: CaseCreate): Promise<Case> {
  return apiRequest<Case>("/cases", { method: "POST", body });
}

/** GET /cases/{id} */
export function getCase(caseId: string): Promise<Case> {
  return apiRequest<Case>(`/cases/${encodeURIComponent(caseId)}`);
}

/** PUT /cases/{id} — solo el propietario puede editar. */
export function updateCase(caseId: string, body: CaseUpdate): Promise<Case> {
  return apiRequest<Case>(`/cases/${encodeURIComponent(caseId)}`, {
    method: "PUT",
    body,
  });
}

/** DELETE /cases/{id} — solo el propietario puede borrar. */
export function deleteCase(caseId: string): Promise<void> {
  return apiRequest<void>(`/cases/${encodeURIComponent(caseId)}`, {
    method: "DELETE",
  });
}

/** POST /cases/{id}/collaborators — invita a otro profesor por email. */
export function addCollaborator(
  caseId: string,
  body: CollaboratorRequest
): Promise<CollaboratorResponse> {
  return apiRequest<CollaboratorResponse>(
    `/cases/${encodeURIComponent(caseId)}/collaborators`,
    { method: "POST", body }
  );
}

/** DELETE /cases/{id}/collaborators/{collaboratorId} */
export function removeCollaborator(caseId: string, collaboratorId: string): Promise<void> {
  return apiRequest<void>(
    `/cases/${encodeURIComponent(caseId)}/collaborators/${encodeURIComponent(collaboratorId)}`,
    { method: "DELETE" }
  );
}

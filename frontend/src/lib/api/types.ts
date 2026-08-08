// Tipos espejo de app/models.py y app/schemas.py del backend (incloudy).
// Mantenlos sincronizados si el backend cambia sus contratos.

export type CaseStatus = "borrador" | "publicado";

export interface Student {
  nombre: string;
  edad?: number | null;
  curso?: string | null;
  descripcion: string;
}

export interface Station {
  orden: number;
  titulo: string;
  descripcion: string;
  completado: boolean;
}

// Beanie serializa el _id de Mongo como "_id" en el JSON de salida.
export interface Case {
  _id: string;
  profesor_id: string;
  colaboradores_ids: string[];
  alumno: Student;
  estaciones: Station[];
  status: CaseStatus;
  created_at: string;
  updated_at: string;
}

export interface StationInput {
  orden: number;
  titulo: string;
  descripcion?: string;
  completado?: boolean;
}

export interface CaseCreate {
  alumno: Student;
  estaciones?: StationInput[];
}

export interface CaseUpdate {
  alumno?: Student;
  estaciones?: StationInput[];
  status?: CaseStatus;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface ChatRequest {
  mensaje: string;
  case_id?: string | null;
}

export interface ChatResponse {
  respuesta: string;
}

export interface CollaboratorRequest {
  email: string;
}

export interface CollaboratorResponse {
  user_id: string;
  email: string;
}

export interface PortalSessionResponse {
  token: string;
  expires_at: string;
  channel_id: string;
  publishable_key: string;
}

// Evento recibido por el WebSocket /ws
export interface CasePublishedEvent {
  event: "case_published";
  case_id: string;
}

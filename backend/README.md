# incloudy · Backend API

API REST y en tiempo real de incloudy, construida con **FastAPI, MongoDB, JWT, Portal y Google Gemini**.

## Stack

- **FastAPI** sobre Uvicorn — API asíncrona con validación tipada (Pydantic) y documentación OpenAPI en `/docs`.
- **MongoDB** con Motor y Beanie — persistencia NoSQL documental.
- **Autenticación JWT** (PyJWT + bcrypt) — acceso exclusivo para profesores.
- **WebSockets** — notificaciones en vivo al publicar un caso (`case_published`).
- **Portal** — salas privadas por caso con sesión limitada a sus participantes.
- **Google Gemini** — asistente conversacional con contexto del caso del alumno.

## Estructura

```
app/
├── main.py          # Aplicación, CORS y WebSocket
├── config.py        # Configuración por variables de entorno
├── models.py        # Modelos Beanie (User, Case, Station)
├── schemas.py       # Contratos y validación de entrada/salida
├── auth.py          # JWT, hashing y dependencias de seguridad
├── ws.py            # Gestión de conexiones WebSocket
├── services/        # Acceso a casos e integraciones con Gemini y Portal
└── routers/         # Endpoints HTTP: auth, cases, chat y portal
portal.config.ts     # Canales privados case-* desplegados en Portal
```

## Ejecución

```bash
uv pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

La documentación interactiva queda en `http://localhost:8000/docs`. Toda operación (salvo registro, login y health) requiere un token Bearer obtenido en `/auth/login`. El campo `_id` identifica cada recurso.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Alta de profesor → token |
| POST | `/auth/login` | Autenticación → token |
| GET | `/auth/me` | Perfil autenticado |
| GET, POST | `/cases` | Listar y crear casos |
| GET, PUT, DELETE | `/cases/{id}` | Consultar, editar y eliminar casos |
| POST | `/cases/{id}/collaborators` | Invitar a un profesor por email |
| DELETE | `/cases/{id}/collaborators/{user_id}` | Retirar acceso a un profesor |
| POST | `/portal/sessions/{case_id}` | Crear una sesión para la sala privada del caso |
| POST | `/chat` | Asistente IA con contexto del caso |
| WS | `/ws?token=<JWT>` | Evento privado `case_published` en tiempo real |
| GET | `/health` | Estado del servicio |

## Configuración

Variables de entorno (ver `.env.example`):

- `MONGODB_URI` / `MONGODB_DB` — conexión a MongoDB
- `JWT_SECRET` — clave para firmar tokens
- `GEMINI_API_KEY` — clave de Gemini (opcional; sin ella el chat responde un fallback)
- `PORTAL_SECRET_KEY` — clave privada `sk_...`, usada solamente por FastAPI
- `PORTAL_PUBLISHABLE_KEY` — clave pública `pk_...` entregada al cliente
- `PORTAL_API_URL` — API de Portal; normalmente `https://api.useportal.co`
- `PORTAL_TOKEN_TTL` — duración de la sesión de sala; por defecto `1h`
- `CORS_ORIGINS` — orígenes permitidos en el navegador

`JWT_SECRET` es obligatorio y debe tener al menos 32 caracteres. En `.env`,
`CORS_ORIGINS` se escribe como una lista JSON, por ejemplo
`["http://localhost:5173"]`.

## Salas privadas con Portal

Cada caso tiene un canal estable `case-{case_id}`. El identificador nunca incluye
el nombre del alumno. Solo el propietario y los colaboradores registrados en
MongoDB pueden solicitar una sesión.

### 1. Invitar a otro profesor

```http
POST /cases/{case_id}/collaborators
Authorization: Bearer <jwt-incloudy>
Content-Type: application/json

{"email": "especialista@colegio.edu"}
```

La operación es idempotente. El profesor invitado aparecerá también al listar
sus casos y podrá consultar el caso y usar su sala, pero no editarlo ni eliminarlo.

### 2. Crear la sesión de la sala

```http
POST /portal/sessions/{case_id}
Authorization: Bearer <jwt-incloudy>
```

Respuesta:

```json
{
  "token": "<jwt-portal>",
  "expires_at": "2026-08-08T00:00:00.000Z",
  "channel_id": "case-6895...",
  "publishable_key": "pk_..."
}
```

FastAPI registra al profesor como miembro y solicita a Portal un token limitado
a ese único canal, con permisos `connect` y `publish`. La clave privada de Portal
nunca se entrega al navegador.

### 3. Desplegar la política privada

Desde `backend`, configura la clave del proyecto y despliega
`portal.config.ts`:

```powershell
npm install --save-dev @portalsdk/config
$env:PORTAL_SECRET="sk_..."
npx @portalsdk/cli deploy --config portal.config.ts
```

La política desactiva usuarios anónimos para todos los canales `case-*`.

### Contrato para el frontend

El frontend deberá instalar `@portalsdk/core` y `@portalsdk/react`, pedir una
sesión al endpoint anterior y entregar `token`, `publishable_key` y
`channel_id` al SDK. El contenido mínimo recomendado para cada mensaje es:

```json
{"text": "Observé un avance en la segunda estación"}
```

El chat de Portal es una conversación entre profesores. El endpoint `/chat`
continúa siendo la conversación separada con Gemini.

## Pruebas

```bash
uv pip install -r requirements-dev.txt
pytest
```

Las pruebas rápidas comprueban tokens JWT, validación de contraseñas y estaciones,
y la construcción del contexto enviado al asistente.

## Despliegue

La API se despliega en **Railway** a partir de la carpeta `backend`:

- **Comando de inicio:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Base de datos:** MongoDB Atlas (plan gratuito), con la URI en `MONGODB_URI` y acceso de red abierto a la API (`0.0.0.0/0`).
- **Variables:** las de la sección anterior; `CORS_ORIGINS` debe apuntar a la URL del frontend.
- **Verificación:** la API responde en `https://<app>.up.railway.app/docs`.

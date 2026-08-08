# incloudy · Backend API

API REST y en tiempo real de incloudy, construida con **FastAPI, MongoDB, JWT, WebSockets y Google Gemini**.

## Stack

- **FastAPI** sobre Uvicorn — API asíncrona con validación tipada (Pydantic) y documentación OpenAPI en `/docs`.
- **MongoDB** con Motor y Beanie — persistencia NoSQL documental.
- **Autenticación JWT** (PyJWT + bcrypt) — acceso exclusivo para profesores.
- **WebSockets** — notificaciones en vivo al publicar un caso (`case_published`).
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
├── services/        # Casos compartidos e integración con Gemini
└── routers/         # Endpoints HTTP: auth, cases, chat
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
| POST | `/chat` | Asistente IA con contexto del caso |
| WS | `/ws?token=<JWT>` | Evento privado `case_published` en tiempo real |
| GET | `/health` | Estado del servicio |

## Configuración

Variables de entorno (ver `.env.example`):

- `MONGODB_URI` / `MONGODB_DB` — conexión a MongoDB
- `JWT_SECRET` — clave para firmar tokens
- `GEMINI_API_KEY` — clave de Gemini (opcional; sin ella el chat responde un fallback)
- `CORS_ORIGINS` — orígenes permitidos en el navegador

`JWT_SECRET` es obligatorio y debe tener al menos 32 caracteres. En `.env`,
`CORS_ORIGINS` se escribe como una lista JSON, por ejemplo
`["http://localhost:5173"]`.

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

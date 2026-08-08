# incloudy - Backend

API del backend para incloudy. **FastAPI + MongoDB (Motor/Beanie) + JWT + WebSockets + Gemini**.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | FastAPI + Uvicorn |
| Base de datos | MongoDB (Motor asíncrono + Beanie ODM) |
| Autenticación | JWT (PyJWT) + bcrypt, solo profesores |
| Tiempo real | WebSockets (aviso al publicar un caso) |
| Chat IA | Google Gemini (REST con httpx) |

## Requisitos

- Python 3.10+
- MongoDB local o cluster de MongoDB Atlas

## Instalación

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
```

## Configuración

Copia `.env.example` a `.env` y ajusta los valores:

```bash
cp .env.example .env
```

- `MONGODB_URI` y `MONGODB_DB`: conexión a MongoDB
- `JWT_SECRET`: secreto para firmar los tokens
- `GEMINI_API_KEY`: clave de Google Gemini (el chat responde un fallback si no está)

## Ejecución

```bash
uvicorn app.main:app --reload
```

La documentación interactiva (Swagger) queda en `http://localhost:8000/docs`.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Registrar profesor (`{ email, password }`) → JWT |
| POST | `/auth/login` | Login (form OAuth2) → JWT |
| GET | `/auth/me` | Email del profesor autenticado |
| GET | `/cases` | Listar casos del profesor |
| POST | `/cases` | Crear caso con alumno y estaciones |
| GET | `/cases/{id}` | Ver caso |
| PUT | `/cases/{id}` | Editar caso (alumno, estaciones, status) |
| DELETE | `/cases/{id}` | Eliminar caso |
| POST | `/chat` | Preguntar al chatbot con contexto del caso |
| WS | `/ws` | Escuchar evento `case_published` |
| GET | `/health` | Estado del servidor |

## Ejemplo de caso

```json
{
  "alumno": {
    "nombre": "Ana Pérez",
    "edad": 10,
    "curso": "4º Primaria",
    "descripcion": "Dificultad de atención sostenida"
  },
  "estaciones": [
    { "orden": 1, "titulo": "Observación", "descripcion": "Primera toma de datos" },
    { "orden": 2, "titulo": "Intervención", "descripcion": "Plan de apoyo" }
  ]
}
```

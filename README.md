# incloudy

<p align="center">
  <img src="frontend/src/assets/images/logo.webp" width="150" alt="Logotipo de incloudy: un mando de videojuegos sobre un libro abierto">
</p>

<p align="center">
  <strong>Acompañamiento educativo colaborativo, privado y en tiempo real.</strong>
</p>

<p align="center">
  Una plataforma para que docentes y especialistas acompañen casos de estudiantes con necesidades educativas especiales mediante un recorrido pedagógico compartido.
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-API-009688?logo=fastapi&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=111827">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white">
  <a href="https://github.com/realtime-hackaton-2026/incloudy/commits/main"><img alt="Último commit" src="https://img.shields.io/github/last-commit/realtime-hackaton-2026/incloudy?display_timestamp=committer&label=last%20commit"></a>
  <a href="https://github.com/realtime-hackaton-2026/incloudy/graphs/contributors"><img alt="Contribuidores" src="https://img.shields.io/github/contributors/realtime-hackaton-2026/incloudy"></a>
</p>

---

## Propósito

El acompañamiento de un estudiante suele distribuirse entre tutores, docentes de apoyo, especialistas y familias. Cuando sus observaciones quedan repartidas entre notas, correos y conversaciones aisladas, el equipo pierde contexto y resulta difícil saber qué se decidió, quién debe actuar o en qué estado se encuentra el caso.

**incloudy** reúne ese trabajo en un espacio común. Cada caso cuenta con un recorrido visible, historial, colaboradores autorizados, notas privadas y una sala de conversación en tiempo real. El objetivo es mantener al equipo coordinado sin convertir el acompañamiento educativo en un expediente impersonal.

> [!IMPORTANT]
> incloudy está diseñado para escenarios educativos ficticios y anonimizados. No deben introducirse nombres reales ni diagnósticos clínicos.

## Recorrido pedagógico

Cada caso avanza por cinco estaciones y ocupa una sola estación a la vez:

| Estación | Objetivo |
|:--|:--|
| **01 · Explorar** | Comprender al estudiante y su contexto. |
| **02 · Orientar** | Definir objetivos compartidos por el equipo. |
| **03 · Actuar** | Seleccionar y poner en marcha intervenciones. |
| **04 · Acompañar** | Registrar el progreso y ajustar la estrategia. |
| **05 · Compartir** | Cerrar el recorrido y comunicar aprendizajes. |

Los profesionales autorizados pueden registrar y actualizar casos, invitar colaboradores con distintos roles, comentar en salas privadas, consultar el historial y generar un resumen pedagógico asistido por IA sin inventar información ausente.

## Stack tecnológico

| Capa | Tecnologías | Responsabilidad |
|:--|:--|:--|
| **Frontend** | React 19.2, TypeScript 6.0, Vite 8.2 | Interfaz, mapa pedagógico y experiencia de usuario. |
| **Backend** | Python, FastAPI, Pydantic | API REST, WebSockets, validación y reglas del dominio. |
| **Persistencia** | MongoDB, Motor 3.6.1, Beanie 1.29.0 | Casos, recorridos, eventos, notas y notificaciones. |
| **Tiempo real** | Portal SDK, WebSockets | Salas privadas, comentarios y actualizaciones por caso. |
| **Inteligencia artificial** | Google Gemini | Orientación y resúmenes basados en el contexto del caso. |
| **Seguridad** | JWT, bcrypt, HMAC-SHA256 | Sesiones, contraseñas, permisos y validación de webhooks. |
| **Calidad** | Pytest, Vitest, Testing Library, ESLint | Pruebas del dominio, integración e interfaz. |

## Arquitectura

```text
┌──────────────────────────────┐
│ React + TypeScript + Vite    │
└──────────────┬───────────────┘
               │ HTTPS / WebSocket
┌──────────────▼───────────────┐
│ FastAPI                      │
│ Auth · Casos · Chat · Portal │
└───────┬──────────┬───────────┘
        │          │
┌───────▼──────┐   ├──────────▶ Portal
│ MongoDB      │   └──────────▶ Google Gemini
│ Motor/Beanie │
└──────────────┘
```

```text
backend/   API REST, WebSockets, persistencia e integraciones
frontend/  Aplicación web, componentes, recorridos y pruebas
assets/    Recursos de identidad visual del proyecto
```

## Ejecución local

### Requisitos

- Python 3
- Node.js compatible con Vite 8
- MongoDB local o una conexión a MongoDB Atlas
- Credenciales de Portal y Gemini para habilitar sus integraciones

### Backend

```powershell
cd backend
uv pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

La API queda disponible en `http://localhost:8000` y su documentación interactiva en `http://localhost:8000/docs`.

Consulta [backend/README.md](backend/README.md) para conocer todas las variables de entorno, endpoints, roles y políticas de privacidad.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`. Puedes cambiar la URL de la API mediante `VITE_API_URL`.

## Despliegue

### API

El backend está preparado para ejecutarse en **Railway** desde el directorio `backend`:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

El servicio requiere las variables de MongoDB Atlas, JWT, Portal, Gemini, CORS y la URL HTTPS del webhook. `JWT_SECRET` debe contener al menos 32 caracteres.

### Aplicación web

El frontend produce archivos estáticos optimizados mediante:

```powershell
cd frontend
npm ci
npm run build
```

El contenido generado en `frontend/dist` puede publicarse en una plataforma de alojamiento estático. La variable `VITE_API_URL` debe apuntar a la URL HTTPS de la API desplegada.

## Verificación

Ejecuta las comprobaciones antes de abrir un pull request:

```powershell
# Frontend
cd frontend
npm run lint
npm run test
npm run build

# Backend
cd ../backend
uv pip install -r requirements-dev.txt
pytest
```

## Contribuir

1. Crea una rama descriptiva desde `main`.
2. Mantén cada cambio enfocado y acompáñalo con pruebas cuando corresponda.
3. Ejecuta la verificación completa del frontend y el backend.
4. Abre un pull request explicando el problema, la solución y cómo se validó.

Al contribuir, preserva los principios del proyecto: privacidad por diseño, acceso mínimo necesario, contenido educativo anonimizado y una experiencia accesible para los equipos docentes.

## Contribuidores

Gracias a quienes construyeron y mantienen incloudy:

- [LuisAlejandroCR](https://github.com/LuisAlejandroCR) 
- [CristhAXe](https://github.com/CristhAXe) 
- [alusilcof5](https://github.com/alusilcof5) 

Las cifras corresponden al historial del repositorio al **8 de agosto de 2026**.

---

<p align="center">
  Creado por <strong>pixel-titans</strong> para el <strong>Realtime Hackathon 2026</strong> · 7–9 de agosto de 2026
</p>

# incloudy

Un caso avanza por cinco estaciones. El equipo docente lo acompaña hasta el final, en tiempo real.

`incloudy` es una herramienta de coordinación en tiempo real para equipos docentes que siguen a estudiantes con necesidades educativas especiales (NEE). Un caso no es un expediente que se llena solo: es un trabajo compartido entre tutores, especialistas y familias, que cambia de manos mientras avanza.

## El problema

Cuando un estudiante con NEE entra en un centro, su acompañamiento lo sostiene mucha gente: el tutor, el docente de apoyo, el especialista, la familia. Cada uno observa lo suyo, toma notas por su cuenta y coordina por correos que nadie vuelve a leer. La información se fragmenta, los avances se pierden en conversaciones y nadie sabe en qué punto quedó el caso.

El resultado es el de siempre: el estudiante paga la falta de coordinación, no la falta de voluntad.

## ¿Qué hace incloudy?

`incloudy` organiza el acompañamiento como un **caso que avanza por un camino de cinco etapas**:

| Etapa | Qué pasa ahí |
|---|---|
| 1 · **Explorar** | Conocer al estudiante y su contexto |
| 2 · **Orientar** | Definir objetivos compartidos |
| 3 · **Actuar** | Poner en marcha las intervenciones |
| 4 · **Acompañar** | Seguir el progreso y ajustar |
| 5 · **Compartir** | Cerrar el caso y compartir aprendizajes |

Cada caso vive en su propia sala privada, donde los docentes autorizados pueden:

- **Registrar el caso de un alumno** y moverlo de etapa cuando la realidad cambia — no cuando alguien recuerda actualizarlo.
- **Invitar colaboradores**: cada profesional ve el mismo caso, en el mismo punto.
- **Comentar en tiempo real** sobre el caso: el equipo sabe quién está conectado y quién está escribiendo.
- **Contar con un asistente con contexto**, que acompaña la redacción de observaciones y resúmenes sin inventar datos.

Todo ocurre sobre un mapa ilustrado con cinco estaciones. El caso ocupa **una sola estación a la vez**: es un estado, no un mundo por recorrer. Ver el mapa es saber, de un vistazo, en qué punto está cada estudiante y qué equipo lo sostiene.

## ¿Para quién?

- **Tutores y docentes de apoyo**, que sostienen el día a día del estudiante.
- **Especialistas**, que entran al caso en momentos puntuales y necesitan ponerse al día sin pedir informes.
- **Equipos directivos**, que quieren ver el panorama sin violar la privacidad de cada caso.

## Privacidad

Los datos de un caso pertenecen a su equipo: las salas son privadas, el acceso se concede por invitación y la información del estudiante nunca viaja en canales públicos. La llave privada de la infraestructura de tiempo real nunca sale del servidor.

---

### Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Backend | FastAPI + MongoDB (Motor/Beanie) |
| Tiempo real | WebSockets + Portal (salas privadas por caso) |
| Asistente | Google Gemini (con contexto del caso) |
| Autenticación | JWT + bcrypt |

### Estructura

```
backend/   # API REST y WebSockets (FastAPI, MongoDB, Portal, Gemini)
frontend/  # App web (React + TypeScript + Vite)
```

### Ejecución local

**Backend** — endpoints, variables de entorno y salas privadas en [`backend/README.md`](backend/README.md):

```bash
cd backend
uv pip install -r requirements.txt
copy .env.example .env   # completa JWT_SECRET, MONGODB_URI, ...
uvicorn app.main:app --reload
```

Documentación interactiva en `http://localhost:8000/docs`.

**Frontend**:

```bash
cd frontend
npm install
npm run dev
```

### Verificación

```bash
cd frontend && npm run lint && npm run build    # frontend
cd backend && uv pip install -r requirements-dev.txt && pytest   # backend
```

### Créditos

Proyecto del **Realtime Hackathon 2026** (Portal, 7–9 de agosto de 2026), por **pixel-titans** — CristhRen, Ana Lucía y alejooo

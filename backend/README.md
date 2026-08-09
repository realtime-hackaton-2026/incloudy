# incloudy · Backend API

Backend del recorrido pedagógico de incloudy. Un profesor analiza un caso
ficticio por estaciones, guarda sus respuestas, obtiene un resumen editable y
puede colaborar en una sala privada de Portal.

## Stack

- FastAPI y Pydantic
- MongoDB con Motor y Beanie
- JWT y bcrypt
- Google Gemini para el resumen pedagógico
- Portal para salas privadas y comentarios en tiempo real

## Ejecución

```powershell
uv pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Documentación interactiva: `http://localhost:8000/docs`.

## Colecciones de MongoDB

| Colección | Contenido |
|---|---|
| `User` | Profesores, correo y contraseña con hash |
| `JourneyTemplate` | Versiones de estaciones y opciones oficiales |
| `CaseScenario` | Contenido canónico del caso ficticio de Alex |
| `Case` | Alumno ficticio, respuestas, progreso, resumen y colaboradores |
| `Invitation` | Invitaciones pendientes, aceptadas o revocadas |
| `CaseEvent` | Historial y seguimiento del caso |
| `Notification` | Notificaciones persistentes por profesor |
| `PortalComment` | Copia de comentarios recibidos mediante webhooks de Portal |
| `TeacherNote` | Notas privadas, visibles únicamente para su autor |

Las contraseñas nunca se guardan ni se devuelven en texto plano.

## Flujo principal

```text
registro/login
  → crear caso con plantilla activa
  → responder estaciones
  → progreso 0–100 %
  → completar recorrido
  → generar resumen con Gemini
  → revisar o editar resumen
  → publicar/cerrar/archivar
  → invitar colaboradores
  → conversar en la sala privada de Portal
```

## Estados del caso

```text
borrador → en_progreso → completado → publicado → cerrado → archivado
```

- Una respuesta válida mueve el caso a `en_progreso`.
- `complete` exige todas las estaciones obligatorias y genera el resumen.
- `publish` exige un caso completado y un resumen guardado.
- Un caso cerrado puede reabrirse.
- Un caso archivado es de solo lectura.

## Endpoints

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Registrar profesor con nombre, email y contraseña |
| POST | `/auth/login` | Obtener JWT de incloudy |
| GET | `/auth/me` | Consultar el profesor autenticado |

### Plantillas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/journeys/templates` | Listar versiones del recorrido |
| GET | `/journeys/templates/active` | Obtener estaciones y opciones activas |
| GET | `/journeys/templates/{id}` | Consultar una versión |
| POST | `/journeys/templates` | Crear una nueva versión |

Al iniciar el backend se guarda de forma idempotente el recorrido completo de
Alex: cinco estaciones, hipótesis, pistas, voces, estrategias, imprevistos,
reglas de cierre, textos del cuaderno y Data Station. El contenido editorial
vive en `JourneyTemplate` y `CaseScenario`; no está codificado en el frontend.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/journeys/scenarios` | Listar escenarios ficticios activos |
| GET | `/journeys/scenarios/caso-alex` | Obtener la presentación e hipótesis de Alex |

Al registrar un profesor se crea una copia independiente del caso de Alex en
`Case`. En el arranque también se provisiona esa copia para profesores que ya
existían. La operación es idempotente: nunca crea dos casos de Alex para la
misma cuenta.

### Casos y recorrido

| Método | Ruta | Descripción |
|---|---|---|
| GET, POST | `/cases` | Listar casos accesibles o crear uno |
| POST | `/cases/join` | Unirse a un caso mediante código de sala |
| GET, PUT, DELETE | `/cases/{id}` | Consultar, editar datos del alumno o eliminar |
| GET | `/cases/{id}/participants` | Resolver propietario y colaboradores con nombre, correo y rol |
| PUT | `/cases/{id}/forix-share` | Habilitar o retirar el caso de Búrix/sala docente |
| PUT | `/cases/{id}/stations/{order}/response` | Guardar respuesta de una estación |
| PUT | `/cases/{id}/unexpected-events/{event_id}/response` | Resolver un imprevisto |
| GET, POST | `/cases/{id}/notes` | Consultar o crear notas privadas |
| DELETE | `/cases/{id}/notes/{note_id}` | Eliminar una nota propia |
| POST | `/cases/{id}/reset` | Reiniciar el progreso del caso |
| GET | `/cases/{id}/report.pdf` | Descargar el informe del recorrido |
| POST | `/cases/{id}/complete` | Validar recorrido y generar resumen |
| POST | `/cases/{id}/summary/generate` | Regenerar resumen de forma controlada |
| PUT | `/cases/{id}/summary` | Editar y persistir el resumen |
| POST | `/cases/{id}/publish` | Publicar análisis completado |
| POST | `/cases/{id}/close` | Cerrar caso |
| POST | `/cases/{id}/reopen` | Reabrir caso cerrado |
| POST | `/cases/{id}/archive` | Archivar caso |
| GET | `/cases/{id}/events` | Consultar historial y seguimiento |
| POST | `/cases/{id}/follow-ups` | Agregar una observación de seguimiento |
| GET | `/cases/{id}/comments` | Consultar comentarios sincronizados desde Portal |
| POST | `/cases/{id}/analysis` | Analizar el caso junto con los aportes de la sala |
| POST | `/cases/{id}/collaborators` | Agregar un docente registrado por correo y rol |
| DELETE | `/cases/{id}/collaborators/{user_id}` | Retirar un colaborador |
| POST | `/cases/{id}/leave` | Abandonar un caso compartido |

### Chat de Búrix

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/chat` | Responder con contexto del caso mediante Gemini o fallback local |

El backend intenta `GEMINI_MODEL` y luego cada valor de
`GEMINI_FALLBACK_MODELS` ante `429`, modelo no disponible, timeout o fallo
temporal. La misma API key se reutiliza; si todos fallan, la orientación local
evita que el flujo pedagógico quede bloqueado.

Crear caso:

```json
{
  "alumno": {
    "nombre": "Caso ficticio A",
    "edad": 10,
    "curso": "Quinto",
    "descripcion": "Caso anonimizado",
    "es_ficticio": true
  },
  "privacy_acknowledged": true
}
```

Responder estación:

```json
{
  "opciones_seleccionadas": ["dificultad_atencion"],
  "comentario": "Se observa especialmente en tareas extensas"
}
```

El backend valida que la estación exista, que los IDs correspondan a opciones
oficiales, que una pregunta de selección única no reciba varias respuestas y
que las estaciones anteriores estén completas. Al responder recalcula y guarda
días, confianza, XP, pistas, hipótesis, estrategia, seguimiento y destinatarios.
El caso incluye `estado_interactivo`, donde se persisten días restantes,
confianza, XP, pistas, hipótesis, estrategia, seguimiento, destinatarios,
imprevistos y notas privadas.

## Resumen final

`POST /cases/{id}/complete` verifica el 100 % de las estaciones obligatorias,
envía sus respuestas a Gemini y guarda el resultado en `resumen_final`.
Si `GEMINI_API_KEY` está vacía, genera un resumen pedagógico local para que el
recorrido pueda completarse sin depender de un servicio externo. El modelo se
configura con `GEMINI_MODEL` y por defecto utiliza `gemini-3.6-flash`. Puedes
definir modelos alternativos, separados por comas, mediante
`GEMINI_FALLBACK_MODELS`. Ante cuota agotada, modelo no disponible o un fallo
temporal, el backend los prueba en orden usando la misma `GEMINI_API_KEY`.
El chat también devuelve una orientación local basada en el progreso mientras
Gemini no esté configurado.

Una edición manual queda protegida. Para sobrescribirla al regenerar:

```json
{
  "overwrite_manual": true
}
```

Sin esa confirmación, el backend responde `409`.

## Colaboración y roles

| Rol | Consultar | Comentar/Portal | Responder/editar | Administrar |
|---|---:|---:|---:|---:|
| propietario | sí | sí | sí | sí |
| editor | sí | sí | sí | no |
| comentarista | sí | sí | no | no |
| lector | sí | no, solo lectura | no | no |

Profesor ya registrado:

```http
POST /cases/{case_id}/collaborators

{"email":"editor@colegio.edu","role":"editor"}
```

Invitación pendiente para cualquier correo:

```http
POST /cases/{case_id}/invitations

{"email":"especialista@colegio.edu","role":"comentarista"}
```

La respuesta contiene un token que el equipo puede enviar por correo. La
persona inicia sesión con el mismo email y acepta mediante:

```http
POST /invitations/{token}/accept
```

Las invitaciones duran 72 horas por defecto y el token solo se almacena como
hash SHA-256.

## Notificaciones

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/notifications` | Últimas 100 notificaciones |
| GET | `/notifications?unread_only=true` | Solo pendientes |
| PUT | `/notifications/{id}/read` | Marcar una como leída |
| PUT | `/notifications/read-all` | Marcar todas como leídas |

Se generan notificaciones al invitar, aceptar, completar, publicar, comentar o
agregar seguimiento.

## Portal

Portal es la infraestructura central de tiempo real de incloudy para la
Realtime Hackathon 2026. No se usa como un chat aislado: coordina presencia,
typing, mensajes, preguntas/respuestas de Búrix y eventos de apertura o cierre
de la mesa docente dentro de un canal privado por caso.

### Flujo realtime

```text
POST /portal/sessions/{case_id}
  → FastAPI verifica acceso y rol
  → emite token Portal limitado a case-{case_id}
  → React conecta mediante @portalsdk/react
  → Portal distribuye presencia, typing y mensajes
  → webhook firmado replica comentarios en PortalComment
```

La identidad no depende del alias que entregue el transporte. El endpoint
`GET /cases/{case_id}/participants` resuelve propietario y colaboradores desde
los usuarios de incloudy, con nombre, correo y rol. Así todos los participantes
ven la misma lista y el historial conserva atribución docente estable.

Variables:

```env
PORTAL_SECRET_KEY=sk_...
PORTAL_PUBLISHABLE_KEY=pk_...
PORTAL_API_URL=https://api.useportal.co
PORTAL_TOKEN_TTL=1h
PORTAL_WEBHOOK_SECRET=whsec_...
```

Una sesión se solicita con:

```http
POST /portal/sessions/{case_id}
```

El JWT resultante está restringido a `case-{case_id}`. Lectores reciben solo
`connect`; propietario, editor y comentarista reciben `connect` y `publish`.

El frontend conserva la conexión mientras el usuario navega por las vistas
operativas. La presencia se reconcilia con el directorio de participantes para
evitar que una suspensión temporal del socket en segundo plano haga desaparecer
al docente de la lista.

### Configuración privada

```powershell
npm install --save-dev @portalsdk/config
$env:PORTAL_SECRET="sk_..."
$env:PORTAL_WEBHOOK_URL="https://TU_API/portal/webhooks"
npx @portalsdk/cli deploy --config portal.config.ts
```

Portal crea el secreto de firma. Obtenlo desde el servidor y guárdalo como
`PORTAL_WEBHOOK_SECRET`:

```http
GET https://api.useportal.co/v1/webhooks/secret
Authorization: Bearer sk_...
```

`POST /portal/webhooks` verifica `portal-signature` mediante HMAC-SHA256 sobre
el cuerpo original, rechaza firmas con más de cinco minutos y deduplica por el
ID del evento. Los mensajes publicados se guardan en `PortalComment`; las
retracciones también se reflejan.

### Tipos de mensajes de la sala

| Tipo | Uso |
|---|---|
| `chat` | Observación escrita por un docente |
| `session_started` / `session_closed` | Control compartido de la mesa |
| `ai_question` / `ai_answer` | Pregunta y respuesta de Búrix visibles para el equipo |
| `burix_analysis` | Análisis colaborativo compartido desde el panel privado |
| `burix_reaction` | Intervención contextual breve de la guía |

Los eventos de control no se presentan como mensajes humanos. El historial se
separa por sesiones y se consulta con scroll desde un modal responsive.

## Privacidad

- `privacy_acknowledged` es obligatorio al crear un caso.
- `alumno.es_ficticio` debe ser `true`.
- Textos y comentarios tienen límites de longitud.
- `DATA_RETENTION_DAYS` define el periodo activo, 30 días por defecto.
- Al iniciar el servicio, los casos vencidos se archivan; no se eliminan de
  manera silenciosa.
- La eliminación definitiva requiere `DELETE /cases/{id}` del propietario.
- La eliminación también limpia invitaciones, eventos, notificaciones y copias
  locales de comentarios asociados al caso.
- La retención del historial alojado por Portal debe configurarse también en el
  proyecto de Portal; MongoDB no puede borrar automáticamente datos remotos.
- No deben ingresarse nombres reales ni diagnósticos clínicos.

## Configuración completa

Consulta `.env.example`. `JWT_SECRET` es obligatorio y debe tener al menos 32
caracteres. `CORS_ORIGINS` utiliza una lista JSON:

```env
CORS_ORIGINS=["http://localhost:5173"]
```

### MongoDB local

La configuración local utiliza `mongodb://127.0.0.1:27017/incloudy`. En Windows:

```powershell
Get-Service MongoDB
Start-Service MongoDB
```

MongoDB se ejecuta como servicio automático. Al arrancar FastAPI se crean los
índices, la plantilla completa, el escenario de Alex y un caso independiente
para cada profesor registrado.

## Pruebas

```powershell
uv pip install -r requirements-dev.txt
pytest
```

Las pruebas cubren validación de plantillas y privacidad, progreso, contexto de
Gemini, permisos de Portal, firma de webhooks y persistencia integrada mediante
una MongoDB simulada.

## Despliegue

Railway ejecuta el backend desde `backend`:

```text
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Configura MongoDB Atlas, Gemini, Portal, JWT, CORS y la URL HTTPS del webhook en
las variables del servicio.

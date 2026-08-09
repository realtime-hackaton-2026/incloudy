# incloudy · Frontend

App web de incloudy: **React 19 + TypeScript + Vite**. Cada pantalla tiene una URL propia (hash routing en `src/App.tsx`), así que se puede navegar directamente a cualquiera.

## Puesta en marcha

```bash
npm install
npm run dev
```

La app queda en `http://localhost:5173`. Para iniciar sesión, ver casos y abrir el detalle de un caso necesitas el backend corriendo (por defecto en `http://localhost:8000`; cámbialo con la variable `VITE_API_URL`, ver `src/lib/http.ts`). Registro e inicio de sesión usan `/auth/register` y `/auth/login`.

## Pantallas y experiencia

Enlaces clicables con `npm run dev` activo:

| Pantalla | URL |
|---|---|
| Iniciar sesión | [http://localhost:5173/#/login](http://localhost:5173/#/login) |
| Crear cuenta | [http://localhost:5173/#/registro](http://localhost:5173/#/registro) |
| Tus casos | [http://localhost:5173/#/casos](http://localhost:5173/#/casos) |
| Detalle de caso | [http://localhost:5173/#/caso/ID](http://localhost:5173/#/caso/ID) |
| Mapa interactivo | [http://localhost:5173/#/mapa](http://localhost:5173/#/mapa) |
| Dashboard | [http://localhost:5173/#/dashboard](http://localhost:5173/#/dashboard) |

Notas:

- **Sesión:** las rutas privadas requieren iniciar sesión; al entrar se abre el mapa y el token se valida con `/auth/me`.
- **Detalle de caso:** el enlace `#/caso/ID` necesita un id real. Ábrelo navegando desde la lista (la URL se actualiza) o copia el `_id` de un caso desde el backend.
- **Mapa:** usa casos reales, permite elegir uno y responder sus cinco estaciones en orden. Muestra fecha límite de cinco días hábiles, vida del recorrido, confianza y XP.
- **Sala docente:** el acceso a Búrix y Portal persiste en mapa, lista y detalle. Se oculta deliberadamente en dashboard.
- **Botón atrás del navegador:** funciona entre pantallas, porque el estado vive en el hash.

## Sala docente con Portal

El componente `OwlDoor` conserva el `CaseRoom` montado incluso cuando el panel
está contraído. `@portalsdk/react` proporciona canal, presencia, typing y
mensajes; la identidad visible se resuelve contra los participantes del caso
para evitar nombres derivados de IDs.

Flujo de uso:

1. El propietario comparte el caso y comunica su código de seis caracteres.
2. Otro docente pulsa **Unirse a sala**, introduce el código y obtiene acceso al caso.
3. El backend entrega una sesión Portal limitada al canal `case-{caseId}`.
4. La lista de conectados se actualiza en tiempo real y conserva la presencia al pasar la pestaña a segundo plano.
5. Con dos o más docentes se puede crear la mesa y conversar mientras se recorre el mapa.
6. Las preguntas a Búrix y sus respuestas se comparten en el mismo canal.
7. El historial anterior se abre como modal responsive con scroll en móvil y escritorio.

Los mensajes se muestran de forma optimista para reducir la sensación de lag.
Las respuestas Markdown de IA se renderizan mediante `RichText`, sin imprimir
asteriscos ni romper listas y párrafos.

## Estructura

```
src/
├── App.tsx            # Shell de la app y hash router (estado → URL)
├── styles.css         # Tokens y estilos globales
├── auth/              # Sesión: login/registro, token en localStorage, /auth/me
├── cases/             # Cliente de casos (lista, detalle, guardado)
├── portal/            # Portal SDK: sesión, presencia, mensajes y sala docente
├── owl/               # Acceso persistente, lobby y panel lateral de la sala
├── chat/              # Cliente de Búrix y render Markdown seguro
├── dashboard/         # Métricas y señales del portafolio docente
├── reward/            # XP y animaciones de progreso
├── lib/http.ts        # fetch con errores ya en español
└── components/
    ├── auth-screen/   # Fondo común de login y registro
    ├── login/         # Iniciar sesión
    ├── registro/      # Crear cuenta
    ├── case-list/     # Lista de casos propios y compartidos
    ├── case-form/     # Detalle de un caso (crear/editar)
    ├── case-map/      # Mapa real con cinco estaciones y popups de misión
    └── confirm-dialog/ # Diálogos de confirmación
```

Assets estáticos (favicon, íconos) en `public/`.

## Verificación

```bash
npm run lint
npm run test
npm run build
```

La interfaz dispone de breakpoints específicos para navegación, métricas del
caso, lobby, panel de sala, historial y formularios. Los botones interactivos
mantienen áreas táctiles legibles y el chat usa scroll interno en pantallas
estrechas.

# incloudy · Frontend

App web de incloudy: **React 19 + TypeScript + Vite**. Cada pantalla tiene una URL propia (hash routing en `src/App.tsx`), así que se puede navegar directamente a cualquiera.

## Puesta en marcha

```bash
npm install
npm run dev
```

La app queda en `http://localhost:5173`. Para iniciar sesión, ver casos y abrir el detalle de un caso necesitas el backend corriendo (por defecto en `http://localhost:8000`; cámbialo con la variable `VITE_API_URL`, ver `src/lib/http.ts`). Registro e inicio de sesión usan `/auth/register` y `/auth/login`.

## Pantallas

Enlaces clicables con `npm run dev` activo:

| Pantalla | URL |
|---|---|
| Iniciar sesión | [http://localhost:5173/#/login](http://localhost:5173/#/login) |
| Crear cuenta | [http://localhost:5173/#/registro](http://localhost:5173/#/registro) |
| Tus casos | [http://localhost:5173/#/casos](http://localhost:5173/#/casos) |
| Detalle de caso | [http://localhost:5173/#/caso/ID](http://localhost:5173/#/caso/ID) |
| Mapa (demo) | [http://localhost:5173/#/mapa](http://localhost:5173/#/mapa) |

Notas:

- **Sesión:** `casos`, `caso` y `mapa` requieren iniciar sesión; sin sesión la app cae al login. Al registrarse o entrar, se continúa en el `#/casos`.
- **Detalle de caso:** el enlace `#/caso/ID` necesita un id real. Ábrelo navegando desde la lista (la URL se actualiza) o copia el `_id` de un caso desde el backend.
- **Mapa (demo):** no está conectado a un caso real todavía; las cinco estaciones se mueven localmente.
- **Botón atrás del navegador:** funciona entre pantallas, porque el estado vive en el hash.

## Estructura

```
src/
├── App.tsx            # Shell de la app y hash router (estado → URL)
├── styles.css         # Tokens y estilos globales
├── auth/              # Sesión: login/registro, token en localStorage, /auth/me
├── cases/             # Cliente de casos (lista, detalle, guardado)
├── lib/http.ts        # fetch con errores ya en español
└── components/
    ├── auth-screen/   # Fondo común de login y registro
    ├── login/         # Iniciar sesión
    ├── registro/      # Crear cuenta
    ├── case-list/     # Lista de casos propios y compartidos
    ├── case-form/     # Detalle de un caso (crear/editar)
    ├── case-map/      # Mapa con las cinco estaciones (+ stations.ts)
    └── confirm-dialog/ # Diálogos de confirmación
```

Assets estáticos (favicon, íconos) en `public/`.

## Verificación

```bash
npm run lint
npm run build
```

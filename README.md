# Flotapp

Sistema de mantenimiento para flotas de camiones en Argentina, multiempresa: cada flota con sus datos
separados, y talleres y recapadoras como proveedores vinculados.

- [Arquitectura](docs/ARQUITECTURA.md): modelo de empresas, roles, seguridad y etapas.
- `src/`: aplicación Next.js con tres apps (Flotapp, Chofer y Taller) sobre las mismas cuentas.
- `supabase/migrations`: esquema de base de datos para Supabase, en orden.
- `supabase/pruebas`: pruebas del esquema en un Postgres local.
- `prototipo/flota-al-dia.html`: prototipo navegable de las pantallas, con datos de ejemplo.

## Las tres apps

Cada persona entra directo a la suya según su rol, y cada una se instala en el celular con su propio ícono.

| App | Dirección | Para quién | Qué hace |
|---|---|---|---|
| **Flotapp** | `/empresa/<id>/panel` | Dueños, administración, jefe de taller | Tablero de costos (por unidad, por chofer, por mes), viajes, taller, gastos, vencimientos, equipo |
| **Flotapp Chofer** | `/chofer` | Choferes | Escanear el QR de la unidad, chequeo de salida, viaje, combustible y gastos, aviso de fallas con fotos |
| **Flotapp Taller** | `/taller` | Mecánicos | Fallas pendientes, resolver en un paso con fotos y costos, órdenes largas, historial |

### El QR de cada unidad

Cada unidad tiene un código de 8 caracteres y su QR (ficha de la unidad → **Imprimir etiqueta**, o
Flota y choferes → **Imprimir QR** para todas). El QR abre `/u/<código>`:

- El **chofer** va al chequeo de salida: kilometraje, combustible y 9 a 11 puntos (neumáticos, frenos y aire,
  luces, dirección, enganche, niveles, pérdidas, espejos, matafuego, tacógrafo, documentación). Si marca un
  problema en un punto crítico, no puede salir: la unidad queda en el taller y la falla llega con sus fotos.
- El **mecánico** va a la ficha de la unidad en la app Taller.
- Un **administrador** elige qué hacer. Desde la app Chofer o Taller, el escáner va directo a lo de esa app.

Las etiquetas se imprimen desde la versión publicada, para que el QR apunte a internet y no a la PC.

### Actividad

**Actividad**, en el menú debajo de Equipo (sólo administradores): quién cambió roles, invitó o quitó personas, borró
unidades, gastos o documentos, cerró órdenes, descartó fallas o intentó entrar donde su rol no deja, con
hora, IP y navegador. Lo anota la base con triggers; nadie lo puede editar ni borrar.

Qué puede hacer cada rol está en una sola tabla, `src/lib/permisos.ts`. Quien intenta entrar donde su rol
no deja ve qué no puede hacer, qué roles sí pueden y a quién pedírselo.

### Planes y pedidos de contratación

La página de inicio muestra los planes (precio fijo por mes según la cantidad de unidades) con un calculador y
un formulario para contratar. Los precios se cambian en `src/lib/planes.ts`. Cada pedido queda guardado en la
base: se ven en Supabase → Table Editor → `solicitudes`, donde también se anota en qué quedó (nueva,
contactada, alta o descartada). Hace falta la migración 0005.

### Invitar al equipo

Equipo → **Invitar a alguien**: se elige el rol y se manda el enlace por WhatsApp, se copia o se muestra
como QR. El enlace sirve una sola vez y vence en 7 días.

## Puesta en marcha

1. **Base de datos.** En Supabase → SQL Editor, ejecutá una sola vez y en orden cada archivo de
   `supabase/migrations` (`0001`, `0002`, `0003`…). Una migración ya aplicada no se edita: los cambios
   van en la siguiente. `/api/estado` dice si falta alguna.
2. **Direcciones de inicio de sesión.** En Supabase → Authentication → URL Configuration:
   - Site URL: la dirección de Vercel (por ejemplo `https://flotapp.vercel.app`).
   - Redirect URLs: agregá `http://localhost:3000/**` y `https://<tu-dominio-de-vercel>/**`.
3. **Mails.** Para invitar choferes de verdad hace falta un servidor de correo propio en Supabase →
   Authentication → SMTP Settings: el incluido sólo manda a los integrantes del proyecto y pocos por hora.
4. **Claves en tu PC.** Copiá `.env.example` como `.env.local` y completá los valores
   (Supabase → Project Settings → API).
5. **Claves en Vercel.** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en
   Vercel → Settings → Environment Variables. `NEXT_PUBLIC_SITE_URL` no hace falta: en Vercel la app
   toma su dirección de cada pedido. Si cambiás una variable, volvé a publicar (Redeploy), porque
   las `NEXT_PUBLIC_*` se fijan al compilar.
6. **Región.** `vercel.json` fija las funciones en la misma región que la base de Supabase, para que
   cada consulta no cruce el continente: São Paulo (`gru1` en Vercel, `sa-east-1` en Supabase).
7. **Protección del acceso.**
   - `FLOTAPP_SECRETO_LIMITES` (sólo servidor, 32+ caracteres al azar) firma las claves del límite de
     intentos de ingreso y registro.
   - CAPTCHA con Cloudflare Turnstile: creá el widget en Cloudflare (dominios de Vercel y `localhost`),
     cargá `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Vercel y en `.env.local`, publicá, y **recién después**
     activalo en Supabase → Authentication → Bot and Abuse Protection con la clave secreta. Al revés, el
     ingreso se traba.
   - Como el ingreso sale del servidor, Supabase ve la IP de Vercel para todos: subí su límite por IP
     (Authentication → Rate Limits); el límite por persona lo hace la app.
8. **Chequeo.** `/api/health` responde 200 si la app y la base andan (para monitoreo, sin datos de
   configuración). `/api/estado`, sólo para administradores, muestra qué variables de Supabase existen
   (sólo los nombres), si las migraciones están al día y la demora a la base. Nunca devuelve claves.

## Desarrollo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run test:db
```

`npm test` corre las pruebas de las reglas de carga. `npm run test:db` levanta un Postgres local y corre
las pruebas de aislamiento, permisos, viajes, taller y tablero del esquema.

### Modo demo

```bash
npm run demo
```

Levanta la app con una flota de ejemplo en memoria (unidades, viajes, fallas con fotos, gastos y
vencimientos), sin Supabase ni cuentas: sirve para ver y probar cada pantalla. Lo que se carga dura
mientras corre el servidor. El rol se cambia con la cookie `demo_rol` (`admin`, `jefe_taller`,
`mecanico`, `chofer` o `lectura`). Sólo funciona en desarrollo: una compilación de producción lo ignora.

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

### Planes, prueba gratis y cobros

- **Planes:** precio fijo por mes o por año (el anual vale 10 meses) según las unidades en servicio. Están en la
  base (Supabase → Table Editor → `planes`): ahí se cambian los precios y la página de venta se actualiza sola.
- **Prueba:** cada flota nueva arranca con 14 días gratis del plan Flota, sin tarjeta. Talleres y recapadoras no pagan.
- **Tope:** la base no deja tener en servicio más unidades que las del plan; la app ofrece subir de plan.
- **Modo consulta:** si termina la prueba sin pagar, o un cobro rechazado pasa sus 7 días de gracia, se ve todo pero
  no se cargan datos. No se borra nada.
- **Suscripción** (menú del administrador): plan, uso, cambio de plan, pagos y baja. El cobro es con Mercado Pago
  Suscripciones, con el email de la cuenta de Mercado Pago de quien paga (si no coincide, Mercado Pago rechaza el
  pago). Al volver de pagar, la app consulta la suscripción y activa el plan sin esperar el aviso; los cobros de cada
  mes llegan por los avisos. En el modo demo un simulador aprueba los pagos.
- **Pedidos de contacto** (flotas de más de 40 unidades o quien quiere ayuda): en Table Editor → `solicitudes`.

Las flotas que ya existían antes de la migración 0006 quedaron activas, sin tope ni vencimiento. Para cambiarlas,
editá su fila en `suscripciones`.

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
8. **Cobros con Mercado Pago.**
   - En Supabase → SQL Editor: `select valor from secretos where clave = 'pagos';` y copiá ese valor en Vercel
     como `FLOTAPP_SECRETO_PAGOS`. Con ese secreto la app anota los pagos sin usar la llave maestra de la base.
   - En Mercado Pago Developers creá una aplicación y copiá su Access Token en Vercel como `MP_ACCESS_TOKEN`
     (primero el de prueba, después el de producción).
   - En la aplicación → Webhooks: dirección `https://<tu-dominio>/api/pagos/mercadopago`, con los eventos
     **Planes y suscripciones** y **Pagos**. Copiá la clave secreta en Vercel como `MP_WEBHOOK_SECRET`.
   - Volvé a publicar. Sin estas variables la prueba gratis funciona igual, pero los planes no se pueden pagar en línea.
   - Para probar sin cobrar: en la aplicación → Cuentas de prueba, creá un vendedor y un comprador (los dos de
     Argentina). Con el token de prueba en Vercel, contratá con el email del comprador de prueba y pagá con una
     tarjeta de prueba (titular `APRO`). Los avisos de prueba se mandan con el simulador de Webhooks.
9. **Chequeo.** `/api/health` responde 200 si la app y la base andan (para monitoreo, sin datos de
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

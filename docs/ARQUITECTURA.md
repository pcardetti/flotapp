# Flotapp · Arquitectura

Sistema de mantenimiento para flotas de camiones, pensado para venderse a varias empresas.
Cada flota tiene sus datos separados. Talleres y recapadoras participan como proveedores y
ven sólo lo que cada flota les asigna.

## Tecnología

| Pieza | Elección | Para qué |
|---|---|---|
| Aplicación web | Next.js + TypeScript + Tailwind | Pantallas de escritorio y celular, un solo código |
| Base de datos | Supabase (Postgres) | Datos, usuarios, archivos (fotos, facturas) |
| Seguridad | Row Level Security de Postgres | El aislamiento entre empresas lo hace la base, no la pantalla |
| Publicación | Vercel, conectado a GitHub | Cada cambio subido se publica solo |
| Región | São Paulo para Supabase (`sa-east-1`) y Vercel (`gru1`) | Menor demora desde Argentina y consultas dentro de la misma región |

## Empresas, personas y roles

Todo cuelga de una **organización**, que puede ser de tres tipos:

- **Flota**: la empresa de transporte. Es la dueña de sus unidades, choferes, órdenes y neumáticos.
- **Taller**: recibe órdenes de trabajo derivadas por una flota.
- **Recapadora**: recibe neumáticos enviados a recapar.

Una persona (usuario) puede pertenecer a varias organizaciones, con un rol en cada una:

| Rol | Dónde | Qué puede hacer |
|---|---|---|
| Administrador | Flota y proveedores | Todo, incluido invitar personas y vincular proveedores |
| Jefe de taller | Flota | Unidades, planes, órdenes, documentos, gastos y neumáticos |
| Mecánico | Flota | App Taller: fallas, trabajos y órdenes, con fotos y costos |
| Chofer | Flota | App Chofer: chequeo de salida con el QR, viajes, gastos y fallas |
| Consulta | Flota | Ver todo, incluido el tablero, sin modificar |
| Operario | Taller o recapadora | Trabajar sobre lo que le asignaron |

Las personas se suman con un **enlace de invitación** (un solo uso, vence en 7 días) que el administrador
manda por WhatsApp o muestra como QR. Si el chofer ya estaba cargado, la cuenta queda vinculada a su ficha.

## Las tres apps

Un solo código sirve tres apps instalables, cada una con su manifiesto, ícono y color:

- **Flotapp** (azul, `/empresa/<id>`): gestión y tablero. Quien es chofer o mecánico no entra acá: va a su app.
- **Flotapp Chofer** (amarillo, `/chofer`): pensada para una mano, botones grandes, la acción principal fija abajo.
- **Flotapp Taller** (cian, `/taller`): lo pendiente primero, agrupado por unidad y con las fallas críticas arriba.

En los formularios de las apps de celular la barra de pestañas se esconde y el botón principal guía hasta
lo que falta completar; si el servidor devuelve un error, el foco va al primer campo a corregir. Las
transiciones entre pantallas usan las View Transitions de React (hacia adelante y hacia atrás), y respetan
la preferencia de movimiento reducido.

La página de inicio es la única que se indexa: presenta las tres apps, cómo funciona y preguntas frecuentes,
con datos estructurados (JSON-LD) para los buscadores. Cualquier enlace de Flotapp que se comparta (también
las invitaciones por WhatsApp) muestra la tarjeta de `opengraph-image.tsx`. Los textos de presentación están
en `src/lib/sitio.ts`. La app usa siempre colores claros, aunque el equipo esté en modo oscuro.

En las tres apps, al tocar un enlace aparece enseguida el esqueleto de la pantalla siguiente (`loading.tsx`),
y si una pantalla no puede cargar explica qué pasó (o que no hay conexión) con un botón para reintentar
(`error.tsx`). Borrar, quitar o cancelar pide confirmación en un cuadro propio (`components/confirmar`) y un
aviso flotante (`components/avisos`) dice cómo salió cada acción.

### Viaje con QR

1. Cada unidad tiene un código propio (`unidades.qr_token`, 8 caracteres sin letras confundibles) impreso como QR.
2. El chofer lo escanea (`/u/<código>`, o desde el escáner de la app) y hace el chequeo de salida:
   kilometraje, combustible y los puntos de `items_chequeo` que corresponden al tipo de unidad.
3. `iniciar_viaje` valida todo en la base: la unidad no está en viaje, en taller ni de baja, no es un remolque,
   el chofer no tiene otro viaje, el kilometraje no baja y no falta ningún punto.
4. Cada problema marcado crea una falla con sus fotos. Si alguno es crítico, el viaje no empieza y la unidad
   queda en taller hasta que se resuelva (`registrar_trabajo`, `cerrar_orden` o `descartar_falla`).
5. `terminar_viaje` registra el kilometraje y el combustible de llegada.

Las fotos se achican en el celular y se suben directo a Storage (balde privado `fotos`, carpeta por empresa);
para mostrarlas se piden enlaces firmados que vencen en una hora.

### Vínculo con proveedores

1. La flota invita a un taller o recapadora y el vínculo queda **pendiente**.
2. El proveedor lo **acepta** y desde ese momento puede recibir trabajo de esa flota.
3. Cualquiera de los dos puede **revocarlo**, y el proveedor deja de ver los datos al instante.

Con el vínculo activo:

- El **taller** ve las órdenes derivadas a él y las unidades de esa flota. Informa avance, repuestos, mano de obra y cierre; al cerrar, como con el taller propio, las fallas de la orden quedan resueltas y la unidad vuelve a servicio si nada más la frena (`terminar_orden`). No ve planes, documentos ni otras órdenes.
- La **recapadora** ve los neumáticos que le enviaron, con su historial. Registra la recepción (dibujo nuevo y costo) o el rechazo por no recapable. Cuando lo devuelve, deja de verlo.

## Datos principales

- `organizaciones`, `miembros`, `vinculos_proveedor`
- `unidades`, `choferes`, `lecturas_km`
- `tareas_plan`: services por km o fecha, lo que llegue primero
- `ordenes`: numeradas desde 1 en cada flota
- `tipos_documento`, `documentos`: RTO, seguro, tacógrafo, licencias, con plazos editables por flota
- `neumaticos`: identidad propia por código, con estado, ubicación, vidas, km y costo acumulado
- `neumatico_eventos`: historial del neumático; no se puede editar ni borrar
- `items_chequeo`, `chequeos`, `viajes`: chequeo de salida y viajes con kilometraje y combustible
- `fallas`: lo que reportan los choferes o sale del chequeo, con gravedad, fotos y estado
- `gastos`: combustible (con litros), peajes, viáticos, seguros, patentes y otros, por unidad y chofer
- `invitaciones`, `configuracion`
- `planes`, `suscripciones`, `pagos`, `eventos_pago`: el catálogo de planes, la suscripción de cada flota (prueba, activa, pago pendiente, cancelada o vencida), sus cobros y los avisos de Mercado Pago, anotados una sola vez.
- `solicitudes`: pedidos de contratación de la página de inicio. Sólo se escriben con `solicitar_contratacion` (con límite por conexión) y nadie los lee por la API: se atienden desde el panel de Supabase.

El **tablero** (`tablero(org, desde, hasta)`) calcula en la base el costo operativo, costo por km, consumo,
gastos por categoría y por mes, y los totales por unidad y por chofer. Sólo lo ven administración, jefe de
taller y consulta.

## Cómo se garantiza el aislamiento

- **Seguridad por fila**: cada consulta pasa por políticas que verifican que el usuario sea miembro de la organización dueña del dato, o proveedor con vínculo activo para lo que le asignaron.
- **Claves compuestas** `(id, organizacion_id)`: la base rechaza, por ejemplo, un documento de la flota B colgado de una unidad de la flota A.
- **Operaciones sensibles en funciones de la base**: montar, rotar, desmontar y recapar neumáticos, y las acciones de talleres y recapadoras. Cada una valida permisos y deja el historial en la misma transacción.
- **Reglas de vínculo**: sólo el proveedor acepta; un vínculo no puede redirigirse a otra flota; no se deriva trabajo a un proveedor sin vínculo activo.
- **Al menos un administrador**: la base no deja degradar ni quitar al último administrador de una empresa (con bloqueo, para que dos cambios simultáneos no la dejen sin ninguno).
- **Auditoría** (`auditoria`): triggers anotan cambios del equipo, invitaciones, borrados, renovaciones, órdenes cerradas, fallas descartadas e intentos sin permiso, con quién, rol, hora, IP y navegador (la app los manda en cabeceras propias). Es inmutable y sólo la lee el administrador de cada empresa.
- **Permisos en un solo lugar** (`src/lib/permisos.ts`): qué puede cada rol. El menú, las pantallas y las acciones del servidor preguntan ahí (`puede`, `abrirSeccion`, `exigir`). Si alguien intenta algo que su rol no permite, queda anotado en Actividad y ve la pantalla Sin acceso: qué no puede hacer, qué roles sí y a quién pedírselo. Las pruebas de la base comparan esa tabla, rol por rol, con las funciones y políticas de la base.
- **Suscripciones en la base**: cada flota nueva arranca con 14 días de prueba; un trigger frena la unidad que pasa el tope del plan (con bloqueo, para que dos altas simultáneas no lo pasen) y otro frena toda escritura de la flota cuando la cuenta queda en modo consulta (prueba o gracia vencidas). Los pagos sólo se anotan con funciones que piden un secreto que comparten el servidor y la base: la app no usa la llave maestra. Los avisos de Mercado Pago se verifican con su firma, se guardan una sola vez y su estado se consulta en la API de Mercado Pago. Sólo una suscripción que se autoriza reemplaza a la vigente (la anterior se da de baja en Mercado Pago); los avisos y cobros de una suscripción que ya no es la vigente no cambian la cuenta.
- **Acceso**: CSP con nonce por pedido, cookies de sesión HttpOnly, fotos subidas con URLs firmadas, límite de intentos de ingreso y registro contado en la base (`consumir_intento`, claves firmadas por el servidor) y CAPTCHA de Cloudflare Turnstile verificado por Supabase.

`supabase/pruebas/probar_esquema.mjs` levanta un Postgres local (PGlite), aplica las migraciones en orden y corre 177 pruebas de aislamiento, roles, vínculos, órdenes, neumáticos, invitaciones, viajes con chequeo, taller, fotos, tablero, límites de acceso, auditoría, coherencia entre los permisos de la app y los de la base, pedidos de contratación y suscripciones. Todas pasan.

`supabase/demo` carga empresas de muestra para mostrar la app (8 flotas, un taller y una recapadora con 20 días de actividad y 5 meses de historia), las verifica entrando como cada cuenta y las borra. `npm run test:demo` prueba todo eso en un Postgres local, con las flotas trabajando a la vez.

Para ver las pantallas sin base ni cuentas está el **modo demo** (`npm run demo`, sólo en desarrollo): un cliente de Supabase de mentira (`src/lib/demo`) que responde con una flota de ejemplo en memoria.

## Etapas

1. **Base** (hecho)
   - Inicio de sesión, alta de empresa, invitaciones por enlace y roles.
   - Flota y choferes, vencimientos, gastos, tablero de costos.
   - Apps Chofer y Taller instalables, QR por unidad, chequeo de salida, fallas y trabajos con fotos.
2. **Proveedores y ruta**
   - Plan de mantenimiento por km o fecha, neumáticos con historial en pantalla.
   - Portal de talleres y recapadoras.
   - Carga sin conexión en la app del chofer.
   - Avisos por mail o WhatsApp (vencimientos, fallas críticas).
3. **Negocio**
   - Planes y cobro de suscripciones (por ejemplo Mercado Pago).
   - Combustible, importación de GPS, reportes y exportación a Excel.

## Decisiones abiertas

- **Qué unidades ve un taller**: hoy ve todas las de la flota vinculada. Se puede limitar a las que tienen órdenes derivadas a él.
- **Edición directa de neumáticos**: el jefe de taller puede corregir datos de un neumático sin generar evento. Se puede forzar que todo cambio pase por funciones con historial.
- **Precios y planes**: por cantidad de unidades, por usuario o fijo por empresa.

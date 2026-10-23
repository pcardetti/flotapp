# Flota al Día · Arquitectura

Sistema de mantenimiento para flotas de camiones, pensado para venderse a varias empresas.
Cada flota tiene sus datos separados. Talleres y recapadoras participan como proveedores y
ven sólo lo que cada flota les asigna. "Flota al Día" es el nombre provisorio.

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
| Jefe de taller | Flota | Unidades, planes, órdenes, documentos y neumáticos |
| Chofer | Flota | Control diario y lectura de kilometraje |
| Consulta | Flota | Ver todo, sin modificar |
| Operario | Taller o recapadora | Trabajar sobre lo que le asignaron |

### Vínculo con proveedores

1. La flota invita a un taller o recapadora y el vínculo queda **pendiente**.
2. El proveedor lo **acepta** y desde ese momento puede recibir trabajo de esa flota.
3. Cualquiera de los dos puede **revocarlo**, y el proveedor deja de ver los datos al instante.

Con el vínculo activo:

- El **taller** ve las órdenes derivadas a él y las unidades de esa flota. Informa avance, repuestos, mano de obra y cierre. No ve planes, documentos ni otras órdenes.
- La **recapadora** ve los neumáticos que le enviaron, con su historial. Registra la recepción (dibujo nuevo y costo) o el rechazo por no recapable. Cuando lo devuelve, deja de verlo.

## Datos principales

- `organizaciones`, `miembros`, `vinculos_proveedor`
- `unidades`, `choferes`, `lecturas_km`
- `tareas_plan`: services por km o fecha, lo que llegue primero
- `ordenes`: numeradas desde 1 en cada flota
- `tipos_documento`, `documentos`: RTO, seguro, tacógrafo, licencias, con plazos editables por flota
- `neumaticos`: identidad propia por código, con estado, ubicación, vidas, km y costo acumulado
- `neumatico_eventos`: historial del neumático; no se puede editar ni borrar
- `controles_diarios`, `configuracion`

## Cómo se garantiza el aislamiento

- **Seguridad por fila**: cada consulta pasa por políticas que verifican que el usuario sea miembro de la organización dueña del dato, o proveedor con vínculo activo para lo que le asignaron.
- **Claves compuestas** `(id, organizacion_id)`: la base rechaza, por ejemplo, un documento de la flota B colgado de una unidad de la flota A.
- **Operaciones sensibles en funciones de la base**: montar, rotar, desmontar y recapar neumáticos, y las acciones de talleres y recapadoras. Cada una valida permisos y deja el historial en la misma transacción.
- **Reglas de vínculo**: sólo el proveedor acepta; un vínculo no puede redirigirse a otra flota; no se deriva trabajo a un proveedor sin vínculo activo.

`supabase/pruebas/probar_esquema.mjs` levanta un Postgres local (PGlite), aplica la migración y corre 36 pruebas de aislamiento, roles, vínculos, órdenes y neumáticos. Todas pasan.

## Etapas

1. **Base**
   - Inicio de sesión, alta de empresa, invitaciones y roles.
   - Flota y choferes, plan de mantenimiento, órdenes, vencimientos, neumáticos con historial, control diario y panel.
2. **Proveedores y ruta**
   - Portal de talleres y recapadoras.
   - App del chofer instalable y con carga sin conexión.
   - Fotos y facturas adjuntas.
   - Avisos por mail.
3. **Negocio**
   - Planes y cobro de suscripciones (por ejemplo Mercado Pago).
   - Combustible, importación de GPS, reportes y exportación a Excel.

## Decisiones abiertas

- **Qué unidades ve un taller**: hoy ve todas las de la flota vinculada. Se puede limitar a las que tienen órdenes derivadas a él.
- **Edición directa de neumáticos**: el jefe de taller puede corregir datos de un neumático sin generar evento. Se puede forzar que todo cambio pase por funciones con historial.
- **Precios y planes**: por cantidad de unidades, por usuario o fijo por empresa.

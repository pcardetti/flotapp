# Flotapp

Sistema de mantenimiento para flotas de camiones en Argentina, multiempresa: cada flota con sus datos
separados, y talleres y recapadoras como proveedores vinculados.

- [Arquitectura](docs/ARQUITECTURA.md): modelo de empresas, roles, seguridad y etapas.
- `supabase/migrations`: esquema de base de datos para Supabase.
- `supabase/pruebas`: pruebas del esquema en un Postgres local.
- `prototipo/flota-al-dia.html`: prototipo navegable de las pantallas (abre en cualquier navegador, con datos de ejemplo).

## Probar el esquema

```bash
npm install --no-save @electric-sql/pglite@0.5.8
node supabase/pruebas/probar_esquema.mjs
```

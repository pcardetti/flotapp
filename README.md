# Flotapp

Sistema de mantenimiento para flotas de camiones en Argentina, multiempresa: cada flota con sus datos
separados, y talleres y recapadoras como proveedores vinculados.

- [Arquitectura](docs/ARQUITECTURA.md): modelo de empresas, roles, seguridad y etapas.
- `src/`: aplicación Next.js (inicio de sesión, alta de empresa, secciones por tipo de empresa y rol).
- `supabase/migrations`: esquema de base de datos para Supabase.
- `supabase/pruebas`: pruebas del esquema en un Postgres local.
- `prototipo/flota-al-dia.html`: prototipo navegable de las pantallas, con datos de ejemplo.

## Puesta en marcha

1. **Base de datos.** En Supabase → SQL Editor, pegá el contenido de
   `supabase/migrations/0001_esquema_inicial.sql` y ejecutalo una sola vez.
2. **Direcciones de inicio de sesión.** En Supabase → Authentication → URL Configuration:
   - Site URL: la dirección de Vercel (por ejemplo `https://flotapp.vercel.app`).
   - Redirect URLs: agregá `http://localhost:3000/**` y `https://<tu-dominio-de-vercel>/**`.
3. **Claves en tu PC.** Copiá `.env.example` como `.env.local` y completá los valores
   (Supabase → Project Settings → API).
4. **Claves en Vercel.** Las mismas variables en Vercel → Settings → Environment Variables,
   con `NEXT_PUBLIC_SITE_URL` apuntando a la dirección de Vercel.

## Desarrollo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run test:db
```

`npm run test:db` levanta un Postgres local y corre las pruebas de aislamiento y permisos del esquema.

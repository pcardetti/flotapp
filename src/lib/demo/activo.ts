// Modo demo: la app corre con datos de ejemplo en memoria, sin Supabase ni cuentas. Sólo en desarrollo
// (npm run demo); en una compilación de producción no se puede activar.
export const modoDemo = () => process.env.NODE_ENV !== 'production' && process.env.FLOTAPP_DEMO === '1';

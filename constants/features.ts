// Flags de features completas pero desactivadas a propósito -- no borrar el
// código detrás de un flag en false, solo ocultarlo de la UI.

// Publicidad (campañas pagas) -- funcionalidad terminada y probada, pero
// desactivada para el lanzamiento: con pocos usuarios todavía no hay a quién
// mostrarle los anuncios, así que cobrarle a un negocio por una campaña que
// nadie va a ver sería un gasto sin beneficio real para él. Reactivar
// cuando haya suficiente tráfico de clientes -- ver services/growth.ts
// (excluye sugerencias de "anúnciate" mientras esto sea false) y
// supabase/functions/check-business-growth/index.ts (mismo flag duplicado
// ahí porque corre en Deno, no puede importar este archivo).
export const ADS_ENABLED = false;

import { supabase } from './supabase';
import type { AiChatAction, AiChatMessage } from '../types/database';

export async function getAiChatHistory(userId: string): Promise<AiChatMessage[]> {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AiChatMessage[];
}

export interface SendAiChatMessageResult {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
}

export async function sendAiChatMessage(text: string): Promise<SendAiChatMessageResult> {
  const { data, error } = await supabase.functions.invoke('ai-assistant', { body: { text } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as SendAiChatMessageResult;
}

interface MinimalRouter {
  push: (href: string) => void;
}

export interface ResolveAiChatActionContext {
  router: MinimalRouter;
  role: 'client' | 'business';
}

// El asistente NUNCA ejecuta la acción sugerida directamente -- esto solo
// traduce el tipo de acción a la navegación real, reusando pantallas ya
// existentes (que a su vez llaman a las funciones de servicio reales).
export function resolveAiChatAction(action: AiChatAction, ctx: ResolveAiChatActionContext): void {
  const { router, role } = ctx;
  const p = action.params ?? {};

  switch (action.type) {
    case 'solicitar_auxilio':
      // Solo el cliente pide auxilio -- un negocio no tiene esa pantalla en
      // su propio navegador (a lo más ve solicitudes de otros en
      // "Solicitudes"), así que no navega a nada en vez de mandarlo a un
      // stack de otro rol.
      if (role === 'business') return;
      router.push('/(client)/(tabs)/auxilio');
      return;

    case 'buscar_taller': {
      const query = p.service_name ? `?service=${encodeURIComponent(p.service_name)}` : '';
      router.push(role === 'business' ? `/(business)/buscar${query}` : `/(client)/(tabs)/buscar${query}`);
      return;
    }

    case 'ver_producto':
      if (!p.product_id) return;
      router.push(
        role === 'business' ? `/(business)/(tabs)/producto/${p.product_id}` : `/(client)/(tabs)/producto/${p.product_id}`
      );
      return;

    case 'ver_servicio':
      if (!p.service_id) return;
      router.push(
        role === 'business' ? `/(business)/(tabs)/servicio/${p.service_id}` : `/(client)/(tabs)/servicio/${p.service_id}`
      );
      return;

    case 'ir_a_catalogo':
      if (role === 'business') {
        router.push('/(business)/(tabs)/catalogo');
        return;
      }
      if (p.business_id) {
        router.push(`/(client)/negocio-catalogo/${p.business_id}`);
        return;
      }
      router.push('/(client)/(tabs)/buscar');
      return;

    case 'ir_a_estadisticas':
      if (role === 'business') router.push('/(business)/estadisticas');
      return;

    case 'crear_campania_publicidad':
      if (role === 'business') router.push('/(business)/publicidad');
      return;

    case 'ver_informe':
      if (!p.report_id) return;
      router.push(role === 'business' ? `/(business)/informe/${p.report_id}` : `/(client)/informe/${p.report_id}`);
      return;

    default:
      return;
  }
}

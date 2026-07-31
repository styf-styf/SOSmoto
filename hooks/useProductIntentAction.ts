import { useState } from 'react';
import { Alert } from 'react-native';
import { updateIntentStatus } from '../services/productIntents';
import type { ProductIntentStatus } from '../types/database';

// La misma lógica de "marcar vendido"/"cancelar venta" estaba reimplementada
// de forma independiente en pedidos.tsx y cliente/[id].tsx -- cualquier
// corrección (como la confirmación al cancelar) había que aplicarla dos
// veces. Genérico sobre T para servir tanto a ProductIntentWithDetails
// (pedidos.tsx) como a ProductIntentWithProduct (cliente/[id].tsx).
export function useProductIntentAction<T extends { id: string; status: ProductIntentStatus }>(
  setItems: (updater: (prev: T[]) => T[]) => void
) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function runAction(intentId: string, status: ProductIntentStatus) {
    setProcessingId(intentId);
    try {
      await updateIntentStatus(intentId, status);
      setItems((prev) => prev.map((i) => (i.id === intentId ? { ...i, status } : i)));
    } catch (err) {
      console.error('update intent status error', err);
      Alert.alert('Error', 'No se pudo actualizar el pedido.');
    } finally {
      setProcessingId(null);
    }
  }

  // 'confirmed'/'unavailable' resuelven un apartado pendiente (mismo par que
  // ya existía solo en el banner del chat, sin confirmación -- ver
  // handleIntentAction en chat/[id].tsx de negocio). Solo cancelar una venta
  // ya confirmada pide confirmación, por ser la única acción irreversible
  // sobre algo que el cliente ya daba por hecho.
  function handleAction(intentId: string, status: ProductIntentStatus) {
    if (status !== 'cancelled_no_show') {
      runAction(intentId, status);
      return;
    }
    Alert.alert('Cancelar venta', '¿Seguro que quieres cancelar esta venta?', [
      { text: 'No cancelar', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => runAction(intentId, status) },
    ]);
  }

  return { processingId, handleAction };
}

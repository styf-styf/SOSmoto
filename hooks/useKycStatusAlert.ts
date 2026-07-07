import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';

type KycStatus = 'pending_review' | 'approved' | 'rejected';

interface KycRow {
  id: string;
  business_id: string;
  status: KycStatus;
  admin_notes: string | null;
}

/**
 * Suscribe en tiempo real a cambios en la solicitud de verificación (KYC)
 * del negocio. Cuando el admin aprueba o rechaza, muestra una alerta in-app
 * inmediata sin depender de push notifications (funciona en Expo Go también).
 */
export function useKycStatusAlert(businessId: string | null | undefined) {
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel(`kyc_business_${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'business_verification_requests',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const row = payload.new as KycRow;
          const key = `${row.id}_${row.status}`;
          if (shownRef.current.has(key)) return;
          shownRef.current.add(key);

          if (row.status === 'approved') {
            Alert.alert(
              '¡Negocio verificado! ✓',
              'Tu negocio obtuvo la insignia de verificado en SOSmoto. Aparecerás como negocio de confianza para los clientes.',
              [{ text: 'Aceptar' }]
            );
          } else if (row.status === 'rejected') {
            const msg = row.admin_notes
              ? `Tu solicitud de verificación fue rechazada. Motivo: ${row.admin_notes}`
              : 'Tu solicitud de verificación fue rechazada. Puedes volver a enviar tus documentos.';
            Alert.alert('Verificación rechazada', msg, [{ text: 'Entendido' }]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);
}

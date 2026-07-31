import { NotificationPrefsScreen } from '../../components/NotificationPrefsScreen';
import type { NotificationCategoryOption } from '../../components/NotificationPrefsList';
import { getMyWorkBusiness } from '../../services/businesses';

const ALL_OPTIONS: NotificationCategoryOption[] = [
  { key: 'auxilio', label: 'Solicitudes de auxilio', hint: 'Nuevas solicitudes cercanas y cambios en las que ya aceptaste.' },
  { key: 'mensajes', label: 'Mensajes', hint: 'Cuando un cliente u otro negocio te escribe.' },
  { key: 'pagos', label: 'Pagos y suscripción', hint: 'Vencimiento próximo o caída de tu plan pago.' },
  { key: 'upselling', label: 'Recomendaciones para crecer', hint: 'Sugerencias de plan o publicidad según el uso de tu negocio.' },
];

// Auxilio en carretera es exclusivo de taller -- tienda nunca recibe
// solicitudes de auxilio, así que ese toggle no debe mostrarse (antes se
// mostraba igual para todos, aunque no hiciera nada para tienda).
async function loadOptions(profileId: string): Promise<NotificationCategoryOption[]> {
  const work = await getMyWorkBusiness(profileId);
  return work?.business.business_type === 'workshop'
    ? ALL_OPTIONS
    : ALL_OPTIONS.filter((opt) => opt.key !== 'auxilio');
}

export default function BusinessNotificationPrefsScreen() {
  return <NotificationPrefsScreen loadOptions={loadOptions} />;
}

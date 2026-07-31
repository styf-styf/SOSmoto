import { NotificationPrefsScreen } from '../../components/NotificationPrefsScreen';
import type { NotificationCategoryOption } from '../../components/NotificationPrefsList';

const OPTIONS: NotificationCategoryOption[] = [
  { key: 'auxilio', label: 'Auxilio en carretera', hint: 'Cuando un taller acepta, cancela o completa tu solicitud.' },
  { key: 'mensajes', label: 'Mensajes', hint: 'Cuando un taller o tienda te escribe.' },
  { key: 'mantenimiento', label: 'Mantenimiento', hint: 'Recordatorios de kilometraje y mantenimiento próximo o vencido.' },
];

export default function ClientNotificationPrefsScreen() {
  return <NotificationPrefsScreen loadOptions={async () => OPTIONS} />;
}

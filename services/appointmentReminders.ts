import * as Notifications from 'expo-notifications';

const REMINDER_MINUTES_BEFORE = 30;

export interface ReminderAppointment {
  id: string;
  requested_at: string | null;
  status: string;
  /** Nombre de la otra parte (taller para el cliente, cliente para el taller) */
  label: string;
  serviceName?: string | null;
}

// Programa una notificación local 30 min antes de la cita.
// Devuelve el identifier para poder cancelarla si la cita se cancela.
export async function scheduleAppointmentReminder(params: {
  appointmentId: string;
  scheduledAt: string;
  clientLabel: string;
  serviceName?: string;
}): Promise<string | null> {
  const fireDate = new Date(params.scheduledAt);
  fireDate.setMinutes(fireDate.getMinutes() - REMINDER_MINUTES_BEFORE);

  if (fireDate.getTime() <= Date.now()) return null; // ya pasó

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Cita en ${REMINDER_MINUTES_BEFORE} min`,
        body: `${params.clientLabel}${params.serviceName ? ` · ${params.serviceName}` : ''}`,
        data: { appointmentId: params.appointmentId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
    return identifier;
  } catch (err) {
    console.warn('schedule reminder error', err);
    return null;
  }
}

export async function cancelAppointmentReminder(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // ignorar si ya fue disparada
  }
}

/**
 * Sincroniza recordatorios locales con la lista de citas actual.
 * - Programa recordatorios para citas confirmadas/agendadas futuras que aún no los tienen.
 * - Cancela recordatorios de citas ya finalizadas o canceladas.
 */
export async function syncAppointmentReminders(appointments: ReminderAppointment[]): Promise<void> {
  const now = Date.now();

  let allScheduled: Notifications.NotificationRequest[] = [];
  try {
    allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    return;
  }

  // Mapa appointmentId → identifier de la notificación ya programada
  const identifierByAptId = new Map<string, string>();
  for (const n of allScheduled) {
    const aptId = n.content.data?.appointmentId as string | undefined;
    if (aptId) identifierByAptId.set(aptId, n.identifier);
  }

  const activeStatuses = new Set(['confirmed', 'scheduled']);

  for (const apt of appointments) {
    const isActive = activeStatuses.has(apt.status);
    const isFuture = apt.requested_at != null && new Date(apt.requested_at).getTime() > now;

    if (isActive && isFuture) {
      // Programar solo si aún no existe
      if (!identifierByAptId.has(apt.id)) {
        await scheduleAppointmentReminder({
          appointmentId: apt.id,
          scheduledAt: apt.requested_at!,
          clientLabel: apt.label,
          serviceName: apt.serviceName ?? undefined,
        });
      }
    } else if (!isActive) {
      // Cancelar si la cita ya terminó o fue cancelada
      const identifier = identifierByAptId.get(apt.id);
      if (identifier) await cancelAppointmentReminder(identifier);
    }
  }
}

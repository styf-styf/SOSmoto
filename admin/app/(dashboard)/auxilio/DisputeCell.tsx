'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DisputeStatus } from '../../../lib/types';

const STATUS_LABEL: Record<DisputeStatus, string> = {
  none: 'Sin marcar',
  flagged: 'Marcada',
  reviewed: 'Revisada',
};

const STATUS_COLOR: Record<DisputeStatus, string> = {
  none: 'text-gray-400',
  flagged: 'text-amber-600',
  reviewed: 'text-green-700',
};

export function DisputeCell({
  requestId,
  status,
  notes,
}: {
  requestId: string;
  status: DisputeStatus;
  notes: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [localStatus, setLocalStatus] = useState<DisputeStatus>(status);
  const [localNotes, setLocalNotes] = useState(notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    setLocalStatus(status);
    setLocalNotes(notes ?? '');
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/auxilio/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispute_status: localStatus, admin_notes: localNotes.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div>
        <button
          onClick={() => setEditing(true)}
          className={`text-xs font-semibold underline ${STATUS_COLOR[status]}`}
        >
          {STATUS_LABEL[status]}
        </button>
        {notes && <p className="mt-1 max-w-[220px] text-xs text-gray-500">{notes}</p>}
      </div>
    );
  }

  return (
    <div className="w-56">
      <select
        value={localStatus}
        onChange={(e) => setLocalStatus(e.target.value as DisputeStatus)}
        className="mb-1 w-full rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
      >
        <option value="none">Sin marcar</option>
        <option value="flagged">Marcada</option>
        <option value="reviewed">Revisada</option>
      </select>
      <textarea
        value={localNotes}
        onChange={(e) => setLocalNotes(e.target.value)}
        placeholder="Nota interna (opcional)"
        rows={2}
        className="mb-1 w-full rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? '...' : 'Guardar'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

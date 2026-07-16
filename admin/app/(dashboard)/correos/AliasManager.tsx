'use client';

import { useState, type FormEvent } from 'react';
import type { AdminEmailAliasRow } from '../../../lib/types';

export function AliasManager({
  aliases,
  onChange,
}: {
  aliases: AdminEmailAliasRow[];
  onChange: (aliases: AdminEmailAliasRow[]) => void;
}) {
  const [localPart, setLocalPart] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/correos/aliases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localPart, label }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    const alias = `${localPart.trim().toLowerCase()}@sosmoto.app`;
    onChange([...aliases, { alias, label: label || localPart, created_at: new Date().toISOString() }]);
    setLocalPart('');
    setLabel('');
  }

  async function handleDelete(alias: string) {
    if (!window.confirm(`¿Eliminar el alias ${alias}? Los correos ya guardados no se borran.`)) return;
    const res = await fetch(`/api/correos/aliases/${encodeURIComponent(alias)}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    onChange(aliases.filter((a) => a.alias !== alias));
  }

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-xs font-semibold text-gray-600">Alias de correo (@sosmoto.app)</p>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <ul className="mb-2 flex flex-col gap-1">
        {aliases.map((a) => (
          <li key={a.alias} className="flex items-center justify-between text-xs">
            <span>
              {a.alias} — {a.label}
            </span>
            <button onClick={() => handleDelete(a.alias)} className="text-red-600 underline">
              Eliminar
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate} className="flex gap-1">
        <input
          value={localPart}
          onChange={(e) => setLocalPart(e.target.value)}
          placeholder="usuario"
          required
          className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <span className="self-center text-xs text-gray-400">@sosmoto.app</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etiqueta"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <button type="submit" disabled={busy} className="rounded bg-primary px-2 py-1 text-xs text-white">
          Agregar
        </button>
      </form>
    </div>
  );
}

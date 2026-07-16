'use client';

import { useState, type FormEvent } from 'react';
import type { AdminEmailAliasRow } from '../../../lib/types';

export interface ComposeDraft {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo: string | null;
  threadReferences: string | null;
}

export function ComposeForm({
  aliases,
  initial,
  onCancel,
  onSent,
}: {
  aliases: AdminEmailAliasRow[];
  initial: ComposeDraft | null;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [from, setFrom] = useState(initial?.from ?? aliases[0]?.alias ?? '');
  const [to, setTo] = useState(initial?.to ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch('/api/correos/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject,
        body,
        inReplyTo: initial?.inReplyTo ?? null,
        threadReferences: initial?.threadReferences ?? null,
      }),
    });
    setSending(false);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      setError(errBody.error ?? 'Ocurrió un error enviando el correo.');
      return;
    }
    onSent();
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-3">
      <h2 className="text-lg font-semibold">Redactar correo</h2>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <label className="text-xs font-medium text-gray-600">
        Desde
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {aliases.map((a) => (
            <option key={a.alias} value={a.alias}>
              {a.label} ({a.alias})
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-gray-600">
        Para
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs font-medium text-gray-600">
        Asunto
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-1 flex-col text-xs font-medium text-gray-600">
        Mensaje
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          className="mt-1 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending || !from}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

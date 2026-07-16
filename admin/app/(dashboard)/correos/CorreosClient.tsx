'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import type { AdminEmailAliasRow, AdminEmailRow } from '../../../lib/types';
import { ComposeForm, type ComposeDraft } from './ComposeForm';
import { AliasManager } from './AliasManager';

type Tab = 'todos' | 'recibidos' | 'enviados';

function extractAddress(address: string): string {
  const match = address.match(/<([^>]+)>/);
  return (match ? match[1] : address).trim();
}

function upsertEmail(list: AdminEmailRow[], row: AdminEmailRow): AdminEmailRow[] {
  const idx = list.findIndex((e) => e.id === row.id);
  if (idx === -1) return [row, ...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const next = list.slice();
  next[idx] = row;
  return next;
}

export function CorreosClient({
  initialEmails,
  aliases,
}: {
  initialEmails: AdminEmailRow[];
  aliases: AdminEmailAliasRow[];
}) {
  const [emails, setEmails] = useState(initialEmails);
  const [aliasList, setAliasList] = useState(aliases);
  const [tab, setTab] = useState<Tab>('todos');
  const [aliasFilter, setAliasFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);
  const [showAliasManager, setShowAliasManager] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Suscripción en tiempo real: la lista inicial viene por props (Server
  // Component); desde acá se mantiene viva sola. Nunca duplica filas: usa el
  // id (siempre el email_id de Resend) para upsert/replace.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('emails-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) setEmails((prev) => prev.filter((e) => e.id !== oldId));
          return;
        }
        setEmails((prev) => upsertEmail(prev, payload.new as AdminEmailRow));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return emails.filter((e) => {
      if (tab === 'recibidos' && e.type !== 'received') return false;
      if (tab === 'enviados' && e.type !== 'sent') return false;
      if (aliasFilter && e.alias !== aliasFilter) return false;
      return true;
    });
  }, [emails, tab, aliasFilter]);

  const unreadByAlias = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of emails) if (e.type === 'received' && !e.read) counts[e.alias] = (counts[e.alias] ?? 0) + 1;
    return counts;
  }, [emails]);

  const selected = emails.find((e) => e.id === selectedId) ?? null;

  const selectEmail = useCallback(async (email: AdminEmailRow) => {
    setComposing(false);
    setSelectedId(email.id);
    if (email.type === 'received' && !email.read) {
      setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, read: true } : e)));
      await fetch(`/api/correos/${email.id}/read`, { method: 'POST' }).catch(() => {});
    }
  }, []);

  function startCompose() {
    setSelectedId(null);
    setComposeDraft(null);
    setComposing(true);
  }

  function startReply(email: AdminEmailRow) {
    const to = email.type === 'received' ? extractAddress(email.from_address) : extractAddress(email.to_address);
    setComposeDraft({
      from: email.alias,
      to,
      subject: email.subject.toLowerCase().startsWith('re:') ? email.subject : `Re: ${email.subject}`,
      body: '',
      inReplyTo: email.message_id,
      threadReferences: [email.thread_references, email.message_id].filter(Boolean).join(' ') || null,
    });
    setSelectedId(null);
    setComposing(true);
  }

  async function handleDelete(email: AdminEmailRow) {
    if (!window.confirm('¿Eliminar este correo? No se puede deshacer.')) return;
    setActionError(null);
    const res = await fetch(`/api/correos/${email.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setEmails((prev) => prev.filter((e) => e.id !== email.id));
    if (selectedId === email.id) setSelectedId(null);
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden">
      <div className="flex w-80 flex-shrink-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 p-3">
          <div className="flex gap-2 text-sm">
            {(['todos', 'recibidos', 'enviados'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-2 py-1 ${tab === t ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {t === 'todos' ? 'Todos' : t === 'recibidos' ? 'Recibidos' : 'Enviados'}
              </button>
            ))}
          </div>
          <button onClick={startCompose} className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white">
            Redactar
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-200 p-2">
          <button
            onClick={() => setAliasFilter(null)}
            className={`rounded-full px-2 py-0.5 text-xs ${!aliasFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Todos los alias
          </button>
          {aliasList.map((a) => (
            <button
              key={a.alias}
              onClick={() => setAliasFilter(a.alias)}
              className={`rounded-full px-2 py-0.5 text-xs ${aliasFilter === a.alias ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {a.alias}
              {unreadByAlias[a.alias] ? (
                <span className="ml-1 rounded-full bg-primary px-1 text-white">{unreadByAlias[a.alias]}</span>
              ) : null}
            </button>
          ))}
          <button
            onClick={() => setShowAliasManager((v) => !v)}
            className="ml-auto rounded-full px-2 py-0.5 text-xs text-gray-400 underline"
          >
            Gestionar alias
          </button>
        </div>

        {showAliasManager && <AliasManager aliases={aliasList} onChange={setAliasList} />}

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-gray-400">No hay correos.</p>}
          {filtered.map((email) => (
            <button
              key={email.id}
              onClick={() => selectEmail(email)}
              className={`flex w-full flex-col items-start gap-0.5 border-b border-gray-100 p-3 text-left text-xs hover:bg-gray-50 ${
                selectedId === email.id ? 'bg-orange-50' : ''
              }`}
            >
              <div className="flex w-full items-center gap-1">
                {email.type === 'received' && !email.read && (
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                )}
                <span className={`truncate ${email.type === 'received' && !email.read ? 'font-bold' : ''}`}>
                  {email.type === 'sent' ? email.to_address : email.from_address}
                </span>
              </div>
              <span className={`w-full truncate ${email.type === 'received' && !email.read ? 'font-semibold' : 'text-gray-600'}`}>
                {email.subject || '(sin asunto)'}
              </span>
              <div className="flex w-full items-center justify-between">
                <span className="rounded bg-gray-100 px-1 text-[10px] text-gray-500">{email.alias}</span>
                <span className="text-[10px] text-gray-400">{new Date(email.created_at).toLocaleString('es-EC')}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl bg-white p-6 shadow-sm">
        {composing ? (
          <ComposeForm
            aliases={aliasList}
            initial={composeDraft}
            onCancel={() => setComposing(false)}
            onSent={() => setComposing(false)}
          />
        ) : selected ? (
          <div>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected.subject || '(sin asunto)'}</h2>
                <p className="text-xs text-gray-500">
                  {selected.type === 'received' ? `De: ${selected.from_address}` : `Para: ${selected.to_address}`}
                </p>
                <p className="text-xs text-gray-400">
                  {selected.alias} · {new Date(selected.created_at).toLocaleString('es-EC')}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startReply(selected)} className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Responder
                </button>
                <button onClick={() => handleDelete(selected)} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                  Eliminar
                </button>
              </div>
            </div>
            {actionError && <p className="mb-2 text-xs text-red-600">{actionError}</p>}
            {selected.html ? (
              <iframe
                title="Cuerpo del correo"
                srcDoc={selected.html}
                sandbox="allow-popups"
                className="h-[60vh] w-full rounded-lg border border-gray-200"
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{selected.text}</pre>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Selecciona un correo o redacta uno nuevo.
          </div>
        )}
      </div>
    </div>
  );
}

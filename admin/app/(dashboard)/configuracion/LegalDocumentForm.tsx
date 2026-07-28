'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminLegalDocumentRow } from '../../../lib/types';

const TYPE_LABEL: Record<string, string> = { terms: 'Términos y Condiciones', privacy: 'Política de Privacidad' };

export function LegalDocumentForm({ type, doc }: { type: 'terms' | 'privacy'; doc: AdminLegalDocumentRow | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(doc?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  function handleCancel() {
    setContent(doc?.content ?? '');
    setError(null);
    setEditing(false);
  }

  async function handlePublish() {
    if (!content.trim()) {
      setError('El contenido no puede estar vacío.');
      return;
    }
    if (!window.confirm(`Vas a publicar una nueva versión de ${TYPE_LABEL[type]}. Se les notificará a TODOS los usuarios (push + campanita). ¿Continuar?`)) {
      return;
    }
    setSaving(true);
    setError(null);
    setPublished(false);
    const res = await fetch('/api/legal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    setPublished(true);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">{TYPE_LABEL[type]}</p>
          <p className="text-xs text-gray-400">
            {doc ? `Versión ${doc.version} · publicada el ${new Date(doc.published_at).toLocaleDateString('es-EC')}` : 'Sin publicar todavía'}
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => { setPublished(false); setEditing(true); }}
            className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Editar
          </button>
        )}
      </div>

      {published && <p className="mb-2 text-xs text-green-700">Publicado y notificado a todos los usuarios.</p>}

      {editing && (
        <>
          <p className="mb-2 text-xs text-gray-400">
            HTML de las secciones (h2/p/ul/table) -- no incluyas el título, la fecha ni el aviso de borrador, esos los pone la página automáticamente.
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-gray-300 p-3 font-mono text-xs text-gray-900"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handlePublish}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Publicando…' : 'Publicar y notificar a todos'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-semibold text-gray-600 disabled:opacity-60"
            >
              Cancelar
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}

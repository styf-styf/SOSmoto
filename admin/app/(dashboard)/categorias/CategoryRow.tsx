'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminCategoryRow } from '../../../lib/types';

export function CategoryRow({ category }: { category: AdminCategoryRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    setName(category.name);
    setError(null);
    setEditing(false);
  }

  async function patch(body: Record<string, string>) {
    const res = await fetch(`/api/categorias/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const resBody = await res.json().catch(() => ({}));
      throw new Error(resBody.error ?? 'Ocurrió un error.');
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await patch({ name: name.trim() });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      await patch({ status: 'approved' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error.');
    } finally {
      setApproving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"? Si hay productos o servicios usándola, no se podrá eliminar hasta que se les cambie de categoría.`)) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/categorias/${category.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Ocurrió un error.');
      return;
    }
    router.refresh();
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-48 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        ) : (
          <span className="font-medium">{category.name}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {category.status === 'pending' ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            Pendiente
          </span>
        ) : (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            Aprobada
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {category.status === 'pending' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
            >
              {approving ? '...' : 'Aprobar'}
            </button>
          )}
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Renombrar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                {deleting ? '...' : 'Eliminar'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? '...' : 'Guardar'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 disabled:opacity-60"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

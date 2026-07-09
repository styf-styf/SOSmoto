import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminCategoryRow, CategoryKind } from '../../../lib/types';
import { CategoryCreateForm } from './CategoryCreateForm';
import { CategoryRow } from './CategoryRow';

function CategoryTable({ title, kind, categories }: { title: string; kind: CategoryKind; categories: AdminCategoryRow[] }) {
  const pendingCount = categories.filter((c) => c.status === 'pending').length;
  return (
    <div className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">
        {title}
        {pendingCount > 0 && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
          </span>
        )}
      </h2>
      <table className="mb-4 w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                No hay categorías todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <CategoryCreateForm kind={kind} />
    </div>
  );
}

export default async function CategoriasPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('categories').select('*').order('status').order('name');
  const categories = (data ?? []) as AdminCategoryRow[];

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Categorías</h1>
      <p className="mb-6 text-sm text-gray-500">
        Lista curada de categorías de producto/servicio. Los negocios eligen entre estas al crear su catálogo; si
        sugieren una nueva queda "Pendiente" acá hasta que la apruebes (mientras tanto ya la pueden usar).
      </p>
      {error && <p className="mb-4 text-sm text-red-600">Error: {error.message}</p>}

      <CategoryTable title="Categorías de producto" kind="product" categories={categories.filter((c) => c.kind === 'product')} />
      <CategoryTable title="Categorías de servicio" kind="service" categories={categories.filter((c) => c.kind === 'service')} />
    </div>
  );
}

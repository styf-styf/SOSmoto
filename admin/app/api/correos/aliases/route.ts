import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { createAdminClient } from '../../../../lib/supabase/admin';

const ALIAS_DOMAIN = 'sosmoto.app';
const ALIAS_RE = /^[a-z0-9._-]+$/;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { localPart, label } = await req.json();
  const clean = String(localPart ?? '').trim().toLowerCase();
  if (!clean || !ALIAS_RE.test(clean)) {
    return NextResponse.json({ error: 'Alias inválido (usa solo letras, números, puntos y guiones)' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('email_aliases')
    .insert({ alias: `${clean}@${ALIAS_DOMAIN}`, label: label ? String(label) : clean });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ese alias ya existe' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

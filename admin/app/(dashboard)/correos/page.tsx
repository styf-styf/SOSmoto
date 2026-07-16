import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminEmailAliasRow, AdminEmailRow } from '../../../lib/types';
import { CorreosClient } from './CorreosClient';

const EMAIL_SELECT =
  'id, type, alias, from_address, to_address, subject, html, text, message_id, in_reply_to, thread_references, read, created_at';

export default async function CorreosPage() {
  const supabase = createAdminClient();

  const [emailsResult, aliasesResult] = await Promise.all([
    supabase.from('emails').select(EMAIL_SELECT).order('created_at', { ascending: false }).limit(200),
    supabase.from('email_aliases').select('alias, label, created_at').order('created_at', { ascending: true }),
  ]);

  const emails = (emailsResult.data ?? []) as AdminEmailRow[];
  const aliases = (aliasesResult.data ?? []) as AdminEmailAliasRow[];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <h1 className="mb-4 text-xl font-bold">Correos</h1>
      {emailsResult.error && <p className="mb-2 text-sm text-red-600">Error: {emailsResult.error.message}</p>}
      <CorreosClient initialEmails={emails} aliases={aliases} />
    </div>
  );
}

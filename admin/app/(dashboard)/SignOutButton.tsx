'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className="text-sm font-medium text-red-600 hover:underline">
      Cerrar sesión
    </button>
  );
}

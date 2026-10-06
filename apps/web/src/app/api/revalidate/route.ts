import { revalidatePath } from 'next/cache';
import type { UserDTO } from '@store/shared';
import { API_URL } from '@/lib/api';

/**
 * Called by the admin panel after menu/category changes so cached storefront
 * pages (home, menu, product pages) update immediately instead of within a
 * minute. Only admins may trigger it: the bearer token is checked against
 * the API.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const me = await fetch(`${API_URL}/api/v1/users/me`, { headers: { Authorization: auth }, cache: 'no-store' });
  if (!me.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (await me.json()) as UserDTO;
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  revalidatePath('/', 'layout'); // every page under the root layout
  return Response.json({ revalidated: true });
}

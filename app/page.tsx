import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';

export default async function Home() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (session) redirect('/admin/slides' as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else redirect('/login' as any);
}

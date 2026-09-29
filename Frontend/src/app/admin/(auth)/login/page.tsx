import { AuthForm } from '@/features/auth/auth-form';
export const metadata = { title: 'Ingresar al panel' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  return <AuthForm mode="login" status={typeof estado === 'string' ? estado : ''} />;
}

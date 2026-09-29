import { AuthForm } from '@/features/auth/auth-form';
export const metadata = { title: 'Cambiar contraseña', referrer: 'no-referrer' as const };
export default function ResetPasswordPage() { return <AuthForm mode="reset" />; }

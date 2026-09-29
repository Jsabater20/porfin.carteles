export interface AdminSession {
  admin: { id: string; name: string; email: string; role: 'OWNER' | 'ADMIN'; active: boolean };
  expiresAt: string;
  csrfToken: string;
}

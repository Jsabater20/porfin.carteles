import type { Request } from 'express';
import type { AdminRole } from '@prisma/client';

export interface AdminIdentity {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
}

export interface AuthenticatedRequest extends Request {
  admin: AdminIdentity;
  adminSession: { id: string; token: string; expiresAt: Date };
}

export const adminSelect = { id: true, name: true, email: true, role: true, active: true } as const;
// Serializa cambios de credenciales, roles y creación de sesiones entre réplicas.
export const ADMIN_LOCK = 729301;

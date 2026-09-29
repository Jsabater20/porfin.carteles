import type { Request } from 'express';
export interface GuestRequest extends Request {
  guestSession: { id: string; token: string; expiresAt: Date };
}

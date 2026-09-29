import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const PUBLIC_ROUTE = 'public-route';
export const ALLOWED_ROLES = 'allowed-roles';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Roles = (...roles: AdminRole[]) => SetMetadata(ALLOWED_ROLES, roles);

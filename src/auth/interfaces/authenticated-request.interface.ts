import { Request } from 'express';
import { UserRole } from '../../user/entities/user.entity';

export interface AuthenticatedUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
    orgId?: string;
    branchId?: string;
    avatar?: {
        id: number;
        originalName?: string;
        url?: string;
        thumbnail?: string;
        medium?: string;
        original?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}

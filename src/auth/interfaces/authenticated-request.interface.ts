import { Request } from 'express';

export interface AuthenticatedUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}

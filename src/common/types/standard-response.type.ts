export interface StandardResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
}

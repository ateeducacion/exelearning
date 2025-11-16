import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(loginDto: {
        email: string;
        password: string;
    }): Promise<{
        access_token: string;
        user: {
            id: number;
            email: string;
            roles: string[];
        };
    }>;
    logout(req: any): Promise<{
        message: string;
    }>;
    checkAuth(req: any): Promise<{
        authenticated: boolean;
    }>;
}

import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private readonly jwtService;
    constructor(jwtService: JwtService);
    login(email: string, password: string): Promise<{
        access_token: string;
        user: {
            id: number;
            email: string;
            roles: string[];
        };
    }>;
    validateUser(email: string, password: string): Promise<any>;
}

export declare class HealthController {
    healthCheck(): {
        status: string;
        timestamp: string;
        service: string;
        environment: string;
    };
    apiHealthCheck(): {
        status: string;
        timestamp: string;
        service: string;
        environment: string;
    };
}

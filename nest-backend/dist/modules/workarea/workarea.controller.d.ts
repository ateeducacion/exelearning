import { Request } from 'express';
import { WorkareaService } from './workarea.service';
export declare class WorkareaController {
    private readonly workareaService;
    constructor(workareaService: WorkareaService);
    renderWorkarea(req: Request): Promise<{
        appVersion: string;
        user: {
            id: number;
            email: string;
            roles: string[];
        };
        config: {
            locale: string;
            theme: string;
            autosaveInterval: number;
            maxFileSize: number;
            allowedExtensions: string[];
            features: {
                collaboration: boolean;
                export: boolean;
                import: boolean;
                templates: boolean;
            };
        };
        symfony: {};
        websocket: {
            url: string;
            port: string | number;
        };
    }>;
}

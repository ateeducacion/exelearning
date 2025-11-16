export declare class WorkareaService {
    getConfig(): Promise<{
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
    }>;
}

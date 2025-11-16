export interface Project {
    id: string;
    odeId: string;
    odeVersionId: string;
    title: string;
    versionName: string;
    fileName: string;
    size: string;
    isManualSave: boolean;
    updatedAt: {
        timestamp: number;
    };
    owner_id: string;
    owner_email: string;
}
export declare class ProjectService {
    private projects;
    findAll(filters?: {
        id?: string;
        title?: string;
        title_like?: string;
        updated_after?: string;
        updated_before?: string;
        search?: string;
        owner_id?: string;
        owner_email?: string;
    }): Promise<Project[]>;
    findOne(id: string): Promise<Project>;
    create(createProjectDto: Partial<Project>): Promise<Project>;
    update(id: string, updateProjectDto: Partial<Project>): Promise<Project>;
    remove(id: string): Promise<Project>;
}

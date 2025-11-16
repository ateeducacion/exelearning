import { ProjectService } from './project.service';
export declare class ProjectController {
    private readonly projectService;
    constructor(projectService: ProjectService);
    listProjects(id?: string, title?: string, title_like?: string, updated_after?: string, updated_before?: string, search?: string, owner_id?: string, owner_email?: string): Promise<import("./project.service").Project[]>;
    getProject(id: string): Promise<import("./project.service").Project>;
    createProject(createProjectDto: any): Promise<import("./project.service").Project>;
    updateProject(id: string, updateProjectDto: any): Promise<import("./project.service").Project>;
    deleteProject(id: string): Promise<void>;
}

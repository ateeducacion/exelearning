"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const common_1 = require("@nestjs/common");
let ProjectService = class ProjectService {
    constructor() {
        this.projects = [
            {
                id: 'proj-001',
                odeId: 'proj-001',
                odeVersionId: 'v1.0',
                title: 'Matemáticas Básicas',
                versionName: 'Versión 1.0',
                fileName: 'matematicas_basicas.elp',
                size: '1024000',
                isManualSave: true,
                updatedAt: { timestamp: Math.floor(Date.now() / 1000) - 86400 },
                owner_id: 'user-001',
                owner_email: 'profesor@exelearning.net',
            },
            {
                id: 'proj-002',
                odeId: 'proj-002',
                odeVersionId: 'v2.1',
                title: 'Historia de España',
                versionName: 'Versión 2.1',
                fileName: 'historia_espana.elp',
                size: '2048000',
                isManualSave: false,
                updatedAt: { timestamp: Math.floor(Date.now() / 1000) - 3600 },
                owner_id: 'user-002',
                owner_email: 'historia@exelearning.net',
            },
            {
                id: 'proj-003',
                odeId: 'proj-003',
                odeVersionId: 'v1.5',
                title: 'Ciencias Naturales',
                versionName: 'Versión 1.5',
                fileName: 'ciencias_naturales.elp',
                size: '3072000',
                isManualSave: true,
                updatedAt: { timestamp: Math.floor(Date.now() / 1000) },
                owner_id: 'user-001',
                owner_email: 'profesor@exelearning.net',
            },
        ];
    }
    async findAll(filters) {
        let result = [...this.projects];
        if (filters) {
            result = result.filter((p) => {
                if (filters.id && p.id !== filters.id) {
                    return false;
                }
                if (filters.title && p.title !== filters.title) {
                    return false;
                }
                if (filters.title_like) {
                    const titleLower = p.title.toLowerCase();
                    const searchLower = filters.title_like.toLowerCase();
                    if (!titleLower.includes(searchLower)) {
                        return false;
                    }
                }
                if (filters.updated_after) {
                    const timestamp = parseInt(filters.updated_after, 10);
                    if (p.updatedAt.timestamp <= timestamp) {
                        return false;
                    }
                }
                if (filters.updated_before) {
                    const timestamp = parseInt(filters.updated_before, 10);
                    if (p.updatedAt.timestamp >= timestamp) {
                        return false;
                    }
                }
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase();
                    const searchableFields = [
                        p.id.toLowerCase(),
                        p.title.toLowerCase(),
                        p.fileName.toLowerCase(),
                    ];
                    if (!searchableFields.some((field) => field.includes(searchLower))) {
                        return false;
                    }
                }
                if (filters.owner_id && p.owner_id !== filters.owner_id) {
                    return false;
                }
                if (filters.owner_email && p.owner_email !== filters.owner_email) {
                    return false;
                }
                return true;
            });
        }
        result.sort((a, b) => b.updatedAt.timestamp - a.updatedAt.timestamp);
        return result;
    }
    async findOne(id) {
        const project = this.projects.find((p) => p.id === id || p.odeId === id);
        if (!project) {
            throw new common_1.NotFoundException(`Project with ID ${id} not found`);
        }
        return project;
    }
    async create(createProjectDto) {
        const timestamp = Math.floor(Date.now() / 1000);
        const newProject = {
            id: `proj-${Date.now()}`,
            odeId: createProjectDto.odeId || `proj-${Date.now()}`,
            odeVersionId: createProjectDto.odeVersionId || 'v1.0',
            title: createProjectDto.title || 'Nuevo Proyecto',
            versionName: createProjectDto.versionName || 'Versión 1.0',
            fileName: createProjectDto.fileName || 'proyecto.elp',
            size: createProjectDto.size || '0',
            isManualSave: createProjectDto.isManualSave ?? true,
            updatedAt: { timestamp },
            owner_id: createProjectDto.owner_id || 'user-001',
            owner_email: createProjectDto.owner_email || 'user@exelearning.net',
        };
        this.projects.push(newProject);
        return newProject;
    }
    async update(id, updateProjectDto) {
        const index = this.projects.findIndex((p) => p.id === id || p.odeId === id);
        if (index === -1) {
            throw new common_1.NotFoundException(`Project with ID ${id} not found`);
        }
        const timestamp = Math.floor(Date.now() / 1000);
        this.projects[index] = {
            ...this.projects[index],
            ...updateProjectDto,
            updatedAt: { timestamp },
        };
        return this.projects[index];
    }
    async remove(id) {
        const index = this.projects.findIndex((p) => p.id === id || p.odeId === id);
        if (index === -1) {
            throw new common_1.NotFoundException(`Project with ID ${id} not found`);
        }
        const [deleted] = this.projects.splice(index, 1);
        return deleted;
    }
};
exports.ProjectService = ProjectService;
exports.ProjectService = ProjectService = __decorate([
    (0, common_1.Injectable)()
], ProjectService);
//# sourceMappingURL=project.service.js.map
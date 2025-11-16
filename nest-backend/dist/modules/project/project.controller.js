"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectController = void 0;
const common_1 = require("@nestjs/common");
const project_service_1 = require("./project.service");
let ProjectController = class ProjectController {
    constructor(projectService) {
        this.projectService = projectService;
    }
    async listProjects(id, title, title_like, updated_after, updated_before, search, owner_id, owner_email) {
        const filters = {
            id,
            title,
            title_like,
            updated_after,
            updated_before,
            search,
            owner_id,
            owner_email,
        };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        return this.projectService.findAll(Object.keys(filters).length > 0 ? filters : undefined);
    }
    async getProject(id) {
        return this.projectService.findOne(id);
    }
    async createProject(createProjectDto) {
        return this.projectService.create(createProjectDto);
    }
    async updateProject(id, updateProjectDto) {
        return this.projectService.update(id, updateProjectDto);
    }
    async deleteProject(id) {
        await this.projectService.remove(id);
        return;
    }
};
exports.ProjectController = ProjectController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('id')),
    __param(1, (0, common_1.Query)('title')),
    __param(2, (0, common_1.Query)('title_like')),
    __param(3, (0, common_1.Query)('updated_after')),
    __param(4, (0, common_1.Query)('updated_before')),
    __param(5, (0, common_1.Query)('search')),
    __param(6, (0, common_1.Query)('owner_id')),
    __param(7, (0, common_1.Query)('owner_email')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "listProjects", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getProject", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createProject", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "updateProject", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "deleteProject", null);
exports.ProjectController = ProjectController = __decorate([
    (0, common_1.Controller)('api/project'),
    __metadata("design:paramtypes", [project_service_1.ProjectService])
], ProjectController);
//# sourceMappingURL=project.controller.js.map
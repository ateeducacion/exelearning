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
exports.WorkareaController = void 0;
const common_1 = require("@nestjs/common");
const workarea_service_1 = require("./workarea.service");
let WorkareaController = class WorkareaController {
    constructor(workareaService) {
        this.workareaService = workareaService;
    }
    async renderWorkarea(req) {
        return {
            appVersion: '3.0.0',
            user: {
                id: 1,
                email: 'user@example.com',
                roles: ['ROLE_USER'],
            },
            config: await this.workareaService.getConfig(),
            symfony: {},
            websocket: {
                url: process.env.WEBSOCKET_URL || 'ws://localhost:3001',
                port: process.env.WEBSOCKET_PORT || 3001,
            },
        };
    }
};
exports.WorkareaController = WorkareaController;
__decorate([
    (0, common_1.Get)('workarea'),
    (0, common_1.Render)('workarea/workarea'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkareaController.prototype, "renderWorkarea", null);
exports.WorkareaController = WorkareaController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [workarea_service_1.WorkareaService])
], WorkareaController);
//# sourceMappingURL=workarea.controller.js.map
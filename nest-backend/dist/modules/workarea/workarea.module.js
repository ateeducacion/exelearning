"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkareaModule = void 0;
const common_1 = require("@nestjs/common");
const workarea_controller_1 = require("./workarea.controller");
const workarea_service_1 = require("./workarea.service");
let WorkareaModule = class WorkareaModule {
};
exports.WorkareaModule = WorkareaModule;
exports.WorkareaModule = WorkareaModule = __decorate([
    (0, common_1.Module)({
        controllers: [workarea_controller_1.WorkareaController],
        providers: [workarea_service_1.WorkareaService],
        exports: [workarea_service_1.WorkareaService],
    })
], WorkareaModule);
//# sourceMappingURL=workarea.module.js.map
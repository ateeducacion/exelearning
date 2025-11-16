import { Controller, Get, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { WorkareaService } from './workarea.service';

@Controller()
export class WorkareaController {
  constructor(private readonly workareaService: WorkareaService) {}

  // Workarea endpoint moved to PagesController for proper authentication
  // This controller is kept for future workarea-specific API endpoints
}
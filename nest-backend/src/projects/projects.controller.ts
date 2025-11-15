import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectSummary } from './entities/project.entity';

@Controller({ path: 'projects', version: '2' })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(): Promise<ProjectSummary[]> {
    return this.projectsService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<ProjectSummary | null> {
    return this.projectsService.findOne(id);
  }

  @Post()
  async create(@Body() payload: CreateProjectDto): Promise<ProjectSummary> {
    return this.projectsService.create(payload);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() payload: UpdateProjectDto
  ): Promise<ProjectSummary> {
    return this.projectsService.update(id, payload);
  }
}

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectSummary } from './entities/project.entity';

@Injectable()
export class ProjectsService {
  private readonly storage = new Map<string, ProjectSummary>();

  async list(): Promise<ProjectSummary[]> {
    return Array.from(this.storage.values());
  }

  async findOne(id: string): Promise<ProjectSummary | null> {
    return this.storage.get(id) ?? null;
  }

  async create(payload: CreateProjectDto): Promise<ProjectSummary> {
    const id = randomUUID();
    const project: ProjectSummary = {
      id,
      title: payload.title,
      ownerId: payload.ownerId,
      pageCount: payload.pageCount ?? 0,
      updatedAt: new Date()
    };
    this.storage.set(id, project);
    return project;
  }

  async update(id: string, payload: UpdateProjectDto): Promise<ProjectSummary> {
    const existing = this.storage.get(id);
    if (!existing) {
      const created = await this.create({
        title: payload.title ?? id,
        ownerId: payload.ownerId ?? 'unknown',
        pageCount: payload.pageCount
      });
      return created;
    }

    const updated: ProjectSummary = {
      ...existing,
      ...payload,
      title: payload.title ?? existing.title,
      ownerId: payload.ownerId ?? existing.ownerId,
      pageCount: payload.pageCount ?? existing.pageCount,
      updatedAt: new Date()
    };
    this.storage.set(id, updated);
    return updated;
  }
}

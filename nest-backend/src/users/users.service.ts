import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserSummary } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly storage = new Map<string, UserSummary>();

  async list(): Promise<UserSummary[]> {
    return Array.from(this.storage.values());
  }

  async findOne(id: string): Promise<UserSummary | null> {
    return this.storage.get(id) ?? null;
  }

  async create(payload: CreateUserDto): Promise<UserSummary> {
    const id = randomUUID();
    const user: UserSummary = {
      id,
      username: payload.username,
      displayName: payload.displayName ?? payload.username,
      roles: payload.roles ?? ['ROLE_USER']
    };
    this.storage.set(id, user);
    return user;
  }

  async update(id: string, payload: UpdateUserDto): Promise<UserSummary> {
    const existing = this.storage.get(id);
    if (!existing) {
      const created = await this.create({
        username: payload.username ?? id,
        displayName: payload.displayName,
        roles: payload.roles
      });
      return created;
    }

    const updated: UserSummary = {
      ...existing,
      ...payload,
      displayName: payload.displayName ?? existing.displayName,
      roles: payload.roles ?? existing.roles
    };
    this.storage.set(id, updated);
    return updated;
  }
}

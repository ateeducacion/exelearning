import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentOdeUsersSyncChanges } from '../../entities/current-ode-users-sync-changes.entity';

/**
 * CurrentOdeUsersSyncChangesService
 * Manages pending synchronization changes made by users
 */
@Injectable()
export class CurrentOdeUsersSyncChangesService {
  constructor(
    @InjectRepository(CurrentOdeUsersSyncChanges)
    private readonly syncChangesRepository: Repository<CurrentOdeUsersSyncChanges>,
  ) {}

  /**
   * Create a new sync change record
   * @param data Sync change data
   * @returns Created sync change
   */
  async create(
    data: Partial<CurrentOdeUsersSyncChanges>,
  ): Promise<CurrentOdeUsersSyncChanges> {
    const syncChange = this.syncChangesRepository.create(data);
    return this.syncChangesRepository.save(syncChange);
  }

  /**
   * Find all sync changes
   * @returns Array of sync changes
   */
  async findAll(): Promise<CurrentOdeUsersSyncChanges[]> {
    return this.syncChangesRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Find sync change by ID
   * @param id Sync change ID
   * @returns Sync change or null
   */
  async findById(id: number): Promise<CurrentOdeUsersSyncChanges | null> {
    return this.syncChangesRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * Get list of sync changes by user
   * Returns changes ordered by creation time (oldest first)
   * @param userUpdate User identifier
   * @returns Array of sync changes
   */
  async getSyncChangesListByUser(
    userUpdate: string,
  ): Promise<CurrentOdeUsersSyncChanges[]> {
    return this.syncChangesRepository.find({
      where: { userUpdate, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Update sync change
   * @param id Sync change ID
   * @param data Update data
   * @returns Updated sync change or null
   */
  async update(
    id: number,
    data: Partial<CurrentOdeUsersSyncChanges>,
  ): Promise<CurrentOdeUsersSyncChanges | null> {
    const syncChange = await this.findById(id);
    if (!syncChange) {
      return null;
    }

    Object.assign(syncChange, data);
    return this.syncChangesRepository.save(syncChange);
  }

  /**
   * Soft delete sync change
   * @param id Sync change ID
   * @returns True if deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    const syncChange = await this.findById(id);
    if (!syncChange) {
      return false;
    }

    syncChange.isActive = false;
    await this.syncChangesRepository.save(syncChange);
    return true;
  }

  /**
   * Remove sync changes by user (hard delete)
   * This performs a hard delete from the database
   * @param userUpdate User identifier
   * @returns Number of sync changes deleted
   */
  async removeCurrentOdeUsersSyncChangesByUser(
    userUpdate: string,
  ): Promise<number> {
    const result = await this.syncChangesRepository.delete({ userUpdate });
    return result.affected || 0;
  }

  /**
   * Soft delete all sync changes by user
   * Sets isActive to false for all user's sync changes
   * @param userUpdate User identifier
   * @returns Number of sync changes soft deleted
   */
  async softDeleteByUser(userUpdate: string): Promise<number> {
    const syncChanges = await this.syncChangesRepository.find({
      where: { userUpdate, isActive: true },
    });

    for (const syncChange of syncChanges) {
      syncChange.isActive = false;
      await this.syncChangesRepository.save(syncChange);
    }

    return syncChanges.length;
  }

  /**
   * Get count of pending sync changes by user
   * @param userUpdate User identifier
   * @returns Number of active sync changes
   */
  async getCountByUser(userUpdate: string): Promise<number> {
    return this.syncChangesRepository.count({
      where: { userUpdate, isActive: true },
    });
  }
}

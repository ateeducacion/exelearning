import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentOdeUsers } from '../../entities/current-ode-users.entity';

/**
 * CurrentOdeUsersService
 * Manages active user sessions in ODE projects
 */
@Injectable()
export class CurrentOdeUsersService {
  constructor(
    @InjectRepository(CurrentOdeUsers)
    private readonly currentOdeUsersRepository: Repository<CurrentOdeUsers>,
  ) {}

  /**
   * Create a new current user session
   * @param data Current user data
   * @returns Created current user session
   */
  async create(data: Partial<CurrentOdeUsers>): Promise<CurrentOdeUsers> {
    const currentUser = this.currentOdeUsersRepository.create(data);
    return this.currentOdeUsersRepository.save(currentUser);
  }

  /**
   * Find all current users
   * @returns Array of current users
   */
  async findAll(): Promise<CurrentOdeUsers[]> {
    return this.currentOdeUsersRepository.find({
      where: { isActive: true },
      order: { lastAction: 'DESC' },
    });
  }

  /**
   * Find current user by ID
   * @param id Current user ID
   * @returns Current user or null
   */
  async findById(id: number): Promise<CurrentOdeUsers | null> {
    return this.currentOdeUsersRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * Find current user by current component ID
   * @param currentComponentId Current component ID
   * @returns Current user or null
   */
  async findByCurrentComponentId(
    currentComponentId: string,
  ): Promise<CurrentOdeUsers | null> {
    return this.currentOdeUsersRepository.findOne({
      where: { currentComponentId, isActive: true },
    });
  }

  /**
   * Get current users with optional filters
   * @param odeId Optional ODE ID filter
   * @param odeVersionId Optional ODE Version ID filter
   * @param odeSessionId Optional ODE Session ID filter
   * @returns Array of current users
   */
  async getCurrentUsers(
    odeId?: string,
    odeVersionId?: string,
    odeSessionId?: string,
  ): Promise<CurrentOdeUsers[]> {
    const where: any = { isActive: true };

    if (odeId) {
      where.odeId = odeId;
    }

    if (odeVersionId) {
      where.odeVersionId = odeVersionId;
    }

    if (odeSessionId) {
      where.odeSessionId = odeSessionId;
    }

    return this.currentOdeUsersRepository.find({
      where,
      order: { lastAction: 'DESC' },
    });
  }

  /**
   * Get current session for a user
   * Returns the most recent session (by lastAction) for the user
   * @param user User identifier
   * @returns Current user session or null
   */
  async getCurrentSessionForUser(user: string): Promise<CurrentOdeUsers | null> {
    return this.currentOdeUsersRepository.findOne({
      where: { user, isActive: true },
      order: { lastAction: 'DESC' },
    });
  }

  /**
   * Find all users in a specific session
   * @param odeSessionId Session ID
   * @returns Array of current users
   */
  async findAllBySessionId(odeSessionId: string): Promise<CurrentOdeUsers[]> {
    return this.currentOdeUsersRepository.find({
      where: { odeSessionId, isActive: true },
      order: { lastAction: 'DESC' },
    });
  }

  /**
   * Find user in a specific session
   * @param odeSessionId Session ID
   * @param user User identifier
   * @returns Current user or null
   */
  async findBySessionAndUser(
    odeSessionId: string,
    user: string,
  ): Promise<CurrentOdeUsers | null> {
    return this.currentOdeUsersRepository.findOne({
      where: { odeSessionId, user, isActive: true },
    });
  }

  /**
   * Update current user session
   * @param id Current user ID
   * @param data Update data
   * @returns Updated current user or null
   */
  async update(
    id: number,
    data: Partial<CurrentOdeUsers>,
  ): Promise<CurrentOdeUsers | null> {
    const currentUser = await this.findById(id);
    if (!currentUser) {
      return null;
    }

    Object.assign(currentUser, data);
    return this.currentOdeUsersRepository.save(currentUser);
  }

  /**
   * Update last action timestamp
   * @param id Current user ID
   * @returns Updated current user or null
   */
  async updateLastAction(id: number): Promise<CurrentOdeUsers | null> {
    const currentUser = await this.findById(id);
    if (!currentUser) {
      return null;
    }

    currentUser.lastAction = new Date();
    return this.currentOdeUsersRepository.save(currentUser);
  }

  /**
   * Update last sync timestamp
   * @param id Current user ID
   * @returns Updated current user or null
   */
  async updateLastSync(id: number): Promise<CurrentOdeUsers | null> {
    const currentUser = await this.findById(id);
    if (!currentUser) {
      return null;
    }

    currentUser.lastSync = new Date();
    return this.currentOdeUsersRepository.save(currentUser);
  }

  /**
   * Update sync flags
   * @param id Current user ID
   * @param flags Sync flags to update
   * @returns Updated current user or null
   */
  async updateSyncFlags(
    id: number,
    flags: {
      syncSaveFlag?: boolean;
      syncNavStructureFlag?: boolean;
      syncPagStructureFlag?: boolean;
      syncComponentsFlag?: boolean;
      syncUpdateFlag?: boolean;
    },
  ): Promise<CurrentOdeUsers | null> {
    const currentUser = await this.findById(id);
    if (!currentUser) {
      return null;
    }

    if (flags.syncSaveFlag !== undefined) {
      currentUser.syncSaveFlag = flags.syncSaveFlag;
    }
    if (flags.syncNavStructureFlag !== undefined) {
      currentUser.syncNavStructureFlag = flags.syncNavStructureFlag;
    }
    if (flags.syncPagStructureFlag !== undefined) {
      currentUser.syncPagStructureFlag = flags.syncPagStructureFlag;
    }
    if (flags.syncComponentsFlag !== undefined) {
      currentUser.syncComponentsFlag = flags.syncComponentsFlag;
    }
    if (flags.syncUpdateFlag !== undefined) {
      currentUser.syncUpdateFlag = flags.syncUpdateFlag;
    }

    return this.currentOdeUsersRepository.save(currentUser);
  }

  /**
   * Soft delete current user session
   * @param id Current user ID
   * @returns True if deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    const currentUser = await this.findById(id);
    if (!currentUser) {
      return false;
    }

    currentUser.isActive = false;
    await this.currentOdeUsersRepository.save(currentUser);
    return true;
  }

  /**
   * Remove user from a session
   * Performs a soft delete (sets isActive to false)
   * @param odeSessionId Session ID
   * @param user User identifier
   * @returns Number of users removed
   */
  async removeByOdeSessionIdAndUser(
    odeSessionId: string,
    user: string,
  ): Promise<number> {
    const users = await this.currentOdeUsersRepository.find({
      where: { odeSessionId, user, isActive: true },
    });

    for (const currentUser of users) {
      currentUser.isActive = false;
      await this.currentOdeUsersRepository.save(currentUser);
    }

    return users.length;
  }

  /**
   * Remove all users from a session
   * @param odeSessionId Session ID
   * @returns Number of users removed
   */
  async removeAllBySessionId(odeSessionId: string): Promise<number> {
    const users = await this.currentOdeUsersRepository.find({
      where: { odeSessionId, isActive: true },
    });

    for (const currentUser of users) {
      currentUser.isActive = false;
      await this.currentOdeUsersRepository.save(currentUser);
    }

    return users.length;
  }

  /**
   * Get count of users in a session
   * @param odeSessionId Session ID
   * @returns Number of active users
   */
  async getCountBySessionId(odeSessionId: string): Promise<number> {
    return this.currentOdeUsersRepository.count({
      where: { odeSessionId, isActive: true },
    });
  }

  /**
   * Get count of users for an ODE
   * @param odeId ODE ID
   * @returns Number of active users
   */
  async getCountByOdeId(odeId: string): Promise<number> {
    return this.currentOdeUsersRepository.count({
      where: { odeId, isActive: true },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeOperationsLog } from '../../entities/ode-operations-log.entity';

/**
 * OdeOperationsLogService
 * Manages audit logging of operations performed on ODE projects
 */
@Injectable()
export class OdeOperationsLogService {
  constructor(
    @InjectRepository(OdeOperationsLog)
    private readonly odeOperationsLogRepository: Repository<OdeOperationsLog>,
  ) {}

  /**
   * Create a new operation log entry
   * @param data Operation log data
   * @returns Created operation log
   */
  async create(data: Partial<OdeOperationsLog>): Promise<OdeOperationsLog> {
    const log = this.odeOperationsLogRepository.create(data);
    return this.odeOperationsLogRepository.save(log);
  }

  /**
   * Insert operation log entry
   * @param odeId ODE ID
   * @param odeVersionId ODE Version ID
   * @param odeSessionId ODE Session ID
   * @param operation Operation type (ADD_IDEVICE, MOVE_BLOCK_TO, etc.)
   * @param idSource Source element ID
   * @param idDestination Destination element ID
   * @param user User performing the operation
   * @param additionalData Additional JSON data
   * @returns Created operation log
   */
  async insertOperation(
    odeId: string,
    odeVersionId: string,
    odeSessionId: string,
    operation: string,
    idSource: string,
    idDestination: string | null,
    user: string,
    additionalData: string | null = null,
  ): Promise<OdeOperationsLog> {
    const log = this.odeOperationsLogRepository.create({
      odeId,
      odeVersionId,
      odeSessionId,
      operation,
      idSource,
      idDestination,
      user,
      additionalData,
      doneFlag: 0, // Not done by default
      doneDatetime: null,
    });

    return this.odeOperationsLogRepository.save(log);
  }

  /**
   * Find all operation logs for an ODE
   * @param odeId ODE ID
   * @returns Array of operation logs
   */
  async findAllByOdeId(odeId: string): Promise<OdeOperationsLog[]> {
    return this.odeOperationsLogRepository.find({
      where: { odeId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all operation logs for an ODE version
   * @param odeVersionId ODE Version ID
   * @returns Array of operation logs
   */
  async findAllByOdeVersionId(
    odeVersionId: string,
  ): Promise<OdeOperationsLog[]> {
    return this.odeOperationsLogRepository.find({
      where: { odeVersionId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all operation logs for a session
   * @param odeSessionId ODE Session ID
   * @returns Array of operation logs
   */
  async findAllByOdeSessionId(
    odeSessionId: string,
  ): Promise<OdeOperationsLog[]> {
    return this.odeOperationsLogRepository.find({
      where: { odeSessionId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all operation logs for a session and user
   * @param odeSessionId ODE Session ID
   * @param user User identifier
   * @returns Array of operation logs
   */
  async findAllBySessionAndUser(
    odeSessionId: string,
    user: string,
  ): Promise<OdeOperationsLog[]> {
    return this.odeOperationsLogRepository.find({
      where: { odeSessionId, user, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find operation log by ID
   * @param id Operation log ID
   * @returns Operation log or null
   */
  async findById(id: number): Promise<OdeOperationsLog | null> {
    return this.odeOperationsLogRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * Get the last operation log (most recent)
   * @returns Last operation log or null
   */
  async getLastOperationLog(): Promise<OdeOperationsLog | null> {
    return this.odeOperationsLogRepository.findOne({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get the last operation log for a specific session
   * @param odeSessionId ODE Session ID
   * @returns Last operation log or null
   */
  async getLastOperationLogBySession(
    odeSessionId: string,
  ): Promise<OdeOperationsLog | null> {
    return this.odeOperationsLogRepository.findOne({
      where: { odeSessionId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get the last operation log for a user in a session
   * @param odeSessionId ODE Session ID
   * @param user User identifier
   * @returns Last operation log or null
   */
  async getLastOperationLogBySessionAndUser(
    odeSessionId: string,
    user: string,
  ): Promise<OdeOperationsLog | null> {
    return this.odeOperationsLogRepository.findOne({
      where: { odeSessionId, user, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all pending operations (doneFlag = 0)
   * @param odeSessionId Optional session ID filter
   * @returns Array of pending operation logs
   */
  async findPendingOperations(
    odeSessionId?: string,
  ): Promise<OdeOperationsLog[]> {
    const where: any = { doneFlag: 0, isActive: true };
    if (odeSessionId) {
      where.odeSessionId = odeSessionId;
    }

    return this.odeOperationsLogRepository.find({
      where,
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Mark operation as done
   * @param id Operation log ID
   * @returns Updated operation log or null
   */
  async markAsDone(id: number): Promise<OdeOperationsLog | null> {
    const log = await this.findById(id);
    if (!log) {
      return null;
    }

    log.doneFlag = 1;
    log.doneDatetime = new Date();

    return this.odeOperationsLogRepository.save(log);
  }

  /**
   * Update operation log
   * @param id Operation log ID
   * @param data Update data
   * @returns Updated operation log or null
   */
  async update(
    id: number,
    data: Partial<OdeOperationsLog>,
  ): Promise<OdeOperationsLog | null> {
    const log = await this.findById(id);
    if (!log) {
      return null;
    }

    Object.assign(log, data);
    return this.odeOperationsLogRepository.save(log);
  }

  /**
   * Soft delete operation log
   * @param id Operation log ID
   * @returns True if deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    const log = await this.findById(id);
    if (!log) {
      return false;
    }

    log.isActive = false;
    await this.odeOperationsLogRepository.save(log);
    return true;
  }

  /**
   * Soft delete all operation logs for a session
   * @param odeSessionId Session ID
   * @returns Number of deleted logs
   */
  async deleteAllBySession(odeSessionId: string): Promise<number> {
    const logs = await this.findAllByOdeSessionId(odeSessionId);

    for (const log of logs) {
      log.isActive = false;
      await this.odeOperationsLogRepository.save(log);
    }

    return logs.length;
  }

  /**
   * Get count of operations by session
   * @param odeSessionId Session ID
   * @returns Number of operations
   */
  async getCountBySession(odeSessionId: string): Promise<number> {
    return this.odeOperationsLogRepository.count({
      where: { odeSessionId, isActive: true },
    });
  }

  /**
   * Get count of pending operations by session
   * @param odeSessionId Session ID
   * @returns Number of pending operations
   */
  async getPendingCountBySession(odeSessionId: string): Promise<number> {
    return this.odeOperationsLogRepository.count({
      where: { odeSessionId, doneFlag: 0, isActive: true },
    });
  }
}

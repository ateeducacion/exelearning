import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OdeFiles } from '../../entities/ode-files.entity';

/**
 * OdeFilesService
 * Service for managing ODE files metadata
 */
@Injectable()
export class OdeFilesService {
  constructor(
    @InjectRepository(OdeFiles)
    private readonly odeFilesRepository: Repository<OdeFiles>,
  ) {}

  /**
   * Find all active files for an ODE
   * @param odeId ODE ID
   * @returns Array of ODE files
   */
  async findAllByOdeId(odeId: string): Promise<OdeFiles[]> {
    return this.odeFilesRepository.find({
      where: { odeId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all active files for an ODE version
   * @param odeVersionId ODE Version ID
   * @returns Array of ODE files
   */
  async findAllByOdeVersionId(odeVersionId: string): Promise<OdeFiles[]> {
    return this.odeFilesRepository.find({
      where: { odeVersionId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find all active files for an iDevice
   * @param odeIdeviceId iDevice ID
   * @returns Array of ODE files
   */
  async findAllByIdeviceId(odeIdeviceId: string): Promise<OdeFiles[]> {
    return this.odeFilesRepository.find({
      where: { odeIdeviceId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find a file by ID
   * @param id File ID
   * @returns OdeFiles or null
   */
  async findById(id: number): Promise<OdeFiles | null> {
    return this.odeFilesRepository.findOne({
      where: { id, isActive: true },
    });
  }

  /**
   * Find file by disk filename
   * @param diskFilename Disk filename
   * @returns OdeFiles or null
   */
  async findByDiskFilename(diskFilename: string): Promise<OdeFiles | null> {
    return this.odeFilesRepository.findOne({
      where: { diskFilename, isActive: true },
    });
  }

  /**
   * Create a new file record
   * @param fileData File data
   * @returns Created file record
   */
  async create(fileData: Partial<OdeFiles>): Promise<OdeFiles> {
    const file = this.odeFilesRepository.create(fileData);
    return this.odeFilesRepository.save(file);
  }

  /**
   * Update a file record
   * @param id File ID
   * @param fileData Updated file data
   * @returns Updated file record or null if not found
   */
  async update(id: number, fileData: Partial<OdeFiles>): Promise<OdeFiles | null> {
    const file = await this.findById(id);
    if (!file) {
      return null;
    }

    Object.assign(file, fileData);
    return this.odeFilesRepository.save(file);
  }

  /**
   * Delete a file record (soft delete)
   * @param id File ID
   * @returns True if deleted, false if not found
   */
  async delete(id: number): Promise<boolean> {
    const file = await this.findById(id);
    if (!file) {
      return false;
    }

    file.isActive = false;
    await this.odeFilesRepository.save(file);
    return true;
  }

  /**
   * Delete all files for an ODE (soft delete)
   * @param odeId ODE ID
   * @returns Number of files deleted
   */
  async deleteAllByOdeId(odeId: string): Promise<number> {
    const files = await this.findAllByOdeId(odeId);

    for (const file of files) {
      file.isActive = false;
      await this.odeFilesRepository.save(file);
    }

    return files.length;
  }

  /**
   * Delete all files for an ODE version (soft delete)
   * @param odeVersionId ODE Version ID
   * @returns Number of files deleted
   */
  async deleteAllByOdeVersionId(odeVersionId: string): Promise<number> {
    const files = await this.findAllByOdeVersionId(odeVersionId);

    for (const file of files) {
      file.isActive = false;
      await this.odeFilesRepository.save(file);
    }

    return files.length;
  }

  /**
   * Get total size of files for an ODE
   * @param odeId ODE ID
   * @returns Total size in bytes
   */
  async getTotalSizeByOdeId(odeId: string): Promise<number> {
    const files = await this.findAllByOdeId(odeId);
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Get total size of files for an ODE version
   * @param odeVersionId ODE Version ID
   * @returns Total size in bytes
   */
  async getTotalSizeByOdeVersionId(odeVersionId: string): Promise<number> {
    const files = await this.findAllByOdeVersionId(odeVersionId);
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Get file count for an ODE
   * @param odeId ODE ID
   * @returns Number of files
   */
  async getFileCountByOdeId(odeId: string): Promise<number> {
    return this.odeFilesRepository.count({
      where: { odeId, isActive: true },
    });
  }

  /**
   * Get file count for an ODE version
   * @param odeVersionId ODE Version ID
   * @returns Number of files
   */
  async getFileCountByOdeVersionId(odeVersionId: string): Promise<number> {
    return this.odeFilesRepository.count({
      where: { odeVersionId, isActive: true },
    });
  }
}

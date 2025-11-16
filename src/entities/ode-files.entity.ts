import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * OdeFiles entity
 * Stores file metadata for ODE projects
 *
 * Tracks uploaded files (images, media, documents) associated with:
 * - ODE projects (odeId)
 * - Specific versions (odeVersionId)
 * - iDevices (odeIdeviceId) - optional
 * - Platform integrations (odePlatformId) - optional
 */
@Entity('ode_files')
@Index('fk_ode_files_1_idx', ['odeId'])
@Index('fk_ode_files_2_idx', ['odeVersionId'])
@Index('fk_ode_files_3_idx', ['odeIdeviceId'])
export class OdeFiles extends BaseEntity {
  @Column({ name: 'ode_id', type: 'varchar', length: 20 })
  odeId: string;

  @Column({ name: 'ode_version_id', type: 'varchar', length: 20 })
  odeVersionId: string;

  @Column({ name: 'ode_idevice_id', type: 'varchar', length: 20, nullable: true })
  odeIdeviceId: string | null;

  @Column({ name: 'ode_platform_id', type: 'varchar', length: 64, nullable: true })
  odePlatformId: string | null;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'version_name', type: 'varchar', length: 255, nullable: true })
  versionName: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_type', type: 'varchar', length: 32 })
  fileType: string;

  @Column({ name: 'disk_filename', type: 'varchar', length: 255 })
  diskFilename: string;

  @Column({ name: 'size', type: 'bigint' })
  size: number;

  @Column({ name: 'user', type: 'varchar', length: 128 })
  user: string;

  @Column({ name: 'is_manual_save', type: 'boolean', default: true })
  isManualSave: boolean;

  /**
   * Get disk filename with files directory path
   * Replaces placeholder with actual FILES_DIR path
   * @param filesDir The files directory path
   * @returns Full path to file on disk
   */
  getDiskFilenameWithFilesDir(filesDir: string): string {
    const FILES_DIR_PLACEHOLDER = '{{files_dir}}';
    return this.diskFilename.replace(
      FILES_DIR_PLACEHOLDER,
      filesDir
    );
  }
}

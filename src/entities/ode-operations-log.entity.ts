import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * OdeOperationsLog entity
 * Stores audit log of operations performed on ODE projects
 *
 * Tracks operations such as:
 * - Copy, move, delete operations on pages/blocks/iDevices
 * - Import/export operations
 * - Version changes
 * - Session-specific operations
 */
@Entity('ode_operations_log')
@Index('idx_ode_id', ['odeId'])
@Index('idx_ode_version_id', ['odeVersionId'])
@Index('idx_ode_session_id', ['odeSessionId'])
@Index('idx_operation', ['operation'])
@Index('idx_done_flag', ['doneFlag'])
export class OdeOperationsLog extends BaseEntity {
  @Column({ name: 'ode_id', type: 'varchar', length: 20 })
  odeId: string;

  @Column({ name: 'ode_version_id', type: 'varchar', length: 20 })
  odeVersionId: string;

  @Column({ name: 'ode_session_id', type: 'varchar', length: 20 })
  odeSessionId: string;

  @Column({ name: 'operation', type: 'varchar', length: 16 })
  operation: string;

  @Column({ name: 'id_source', type: 'varchar', length: 20 })
  idSource: string;

  @Column({ name: 'id_destination', type: 'varchar', length: 20, nullable: true })
  idDestination: string | null;

  @Column({ name: 'user', type: 'varchar', length: 128 })
  user: string;

  @Column({ name: 'additional_data', type: 'varchar', length: 4096, nullable: true })
  additionalData: string | null;

  @Column({ name: 'done_flag', type: 'int' })
  doneFlag: number;

  @Column({ name: 'done_datetime', type: 'datetime', nullable: true })
  doneDatetime: Date | null;
}

import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * CurrentOdeUsers entity
 * Tracks users actively working on ODE projects
 *
 * This entity manages:
 * - Active user sessions and their current location
 * - Pending updates to pages, blocks, and components
 * - Synchronization flags for different structures
 * - Last action and sync timestamps
 * - Node IP for distributed systems
 */
@Entity('current_ode_users')
@Index('index2', ['odeId'])
@Index('index3', ['odeVersionId'])
@Index('index4', ['odeSessionId'])
@Index('index5', ['user'])
@Index('index6', ['odeSessionId', 'user'])
export class CurrentOdeUsers extends BaseEntity {
  @Column({ name: 'ode_id', type: 'varchar', length: 20 })
  odeId: string;

  @Column({ name: 'ode_version_id', type: 'varchar', length: 20 })
  odeVersionId: string;

  @Column({ name: 'ode_session_id', type: 'varchar', length: 20 })
  odeSessionId: string;

  @Column({ name: 'user', type: 'varchar', length: 128 })
  user: string;

  @Column({ name: 'last_action', type: 'datetime' })
  lastAction: Date;

  @Column({ name: 'current_page_id', type: 'varchar', length: 64, nullable: true })
  currentPageId: string | null;

  @Column({ name: 'current_block_id', type: 'varchar', length: 64, nullable: true })
  currentBlockId: string | null;

  @Column({ name: 'current_component_id', type: 'varchar', length: 64, nullable: true })
  currentComponentId: string | null;

  @Column({ name: 'ode_page_id_update', type: 'varchar', length: 64, nullable: true })
  odePageIdUpdate: string | null;

  @Column({ name: 'ode_block_id_update', type: 'varchar', length: 64, nullable: true })
  odeBlockIdUpdate: string | null;

  @Column({ name: 'ode_component_id_update', type: 'varchar', length: 64, nullable: true })
  odeComponentIdUpdate: string | null;

  @Column({ name: 'destination_page_id_update', type: 'varchar', length: 64, nullable: true })
  destinationPageIdUpdate: string | null;

  @Column({ name: 'action_type_update', type: 'varchar', length: 64, nullable: true })
  actionTypeUpdate: string | null;

  @Column({ name: 'last_sync', type: 'datetime' })
  lastSync: Date;

  @Column({ name: 'sync_save_flag', type: 'boolean' })
  syncSaveFlag: boolean;

  @Column({ name: 'sync_nav_structure_flag', type: 'boolean' })
  syncNavStructureFlag: boolean;

  @Column({ name: 'sync_pag_structure_flag', type: 'boolean' })
  syncPagStructureFlag: boolean;

  @Column({ name: 'sync_components_flag', type: 'boolean' })
  syncComponentsFlag: boolean;

  @Column({ name: 'sync_update_flag', type: 'boolean' })
  syncUpdateFlag: boolean;

  @Column({ name: 'node_ip', type: 'varchar', length: 50 })
  nodeIp: string;
}

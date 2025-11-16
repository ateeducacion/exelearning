import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * CurrentOdeUsersSyncChanges entity
 * Tracks pending synchronization changes made by users
 *
 * This entity manages a queue of pending updates to:
 * - Pages, blocks, and components
 * - Destination pages (for move operations)
 * - Style themes
 * - Action types
 * - User who made the change
 *
 * Changes are created when users perform operations and consumed
 * by the synchronization system to coordinate updates across sessions.
 */
@Entity('current_ode_users_sync_changes')
@Index('idx_user_update', ['userUpdate'])
export class CurrentOdeUsersSyncChanges extends BaseEntity {
  @Column({ name: 'ode_page_id_update', type: 'varchar', length: 64, nullable: true })
  odePageIdUpdate: string | null;

  @Column({ name: 'ode_block_id_update', type: 'varchar', length: 64, nullable: true })
  odeBlockIdUpdate: string | null;

  @Column({ name: 'ode_component_id_update', type: 'varchar', length: 64, nullable: true })
  odeComponentIdUpdate: string | null;

  @Column({ name: 'destination_page_id_update', type: 'varchar', length: 64, nullable: true })
  destinationPageIdUpdate: string | null;

  @Column({ name: 'style_theme_id_update', type: 'varchar', length: 64, nullable: true })
  styleThemeIdUpdate: string | null;

  @Column({ name: 'action_type_update', type: 'varchar', length: 64, nullable: true })
  actionTypeUpdate: string | null;

  @Column({ name: 'user_update', type: 'varchar', length: 128, nullable: true })
  userUpdate: string | null;
}

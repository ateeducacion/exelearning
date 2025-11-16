import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { OdeNavStructureSync } from './ode-nav-structure-sync.entity';
import { OdePagStructureSyncProperties } from './ode-pag-structure-sync-properties.entity';
import { OdeComponentsSync } from './ode-components-sync.entity';

/**
 * OdePagStructureSync entity
 * Represents content blocks within pages
 *
 * This entity manages:
 * - Block hierarchy (parent-child block relationships)
 * - Block ordering within the page
 * - Block properties (via OdePagStructureSyncProperties)
 * - Associated page (via OdeNavStructureSync)
 *
 * Note: OdeComponentsSync relationship will be added when Components entities are migrated
 */
@Entity('ode_pag_structure_sync')
@Index('fk_ode_pag_structure_sync_1_idx', ['odePagStructureSyncId'])
@Index('fk_ode_pag_structure_sync_2_idx', ['odeNavStructureSyncId'])
export class OdePagStructureSync extends BaseEntity {
  @Column({ name: 'ode_session_id', type: 'varchar', length: 20 })
  odeSessionId: string;

  @Column({ name: 'ode_page_id', type: 'varchar', length: 20 })
  odePageId: string;

  @Column({ name: 'ode_block_id', type: 'varchar', length: 20 })
  odeBlockId: string;

  @Column({ name: 'ode_parent_block_id', type: 'varchar', length: 20, nullable: true })
  odeParentBlockId: string | null;

  @Column({ name: 'block_name', type: 'varchar', length: 255 })
  blockName: string;

  @Column({ name: 'icon_name', type: 'varchar', length: 255, nullable: true })
  iconName: string | null;

  @Column({ name: 'ode_pag_structure_sync_order', type: 'integer' })
  odePagStructureSyncOrder: number;

  // Self-referencing relationship - parent block
  @Column({ name: 'ode_pag_structure_sync_id', type: 'integer', nullable: true })
  odePagStructureSyncId: number | null;

  @ManyToOne(
    () => OdePagStructureSync,
    { onDelete: 'CASCADE', nullable: true },
  )
  @JoinColumn({ name: 'ode_pag_structure_sync_id' })
  odePagStructureSync: OdePagStructureSync | null;

  // Relationship to parent page
  @Column({ name: 'ode_nav_structure_sync_id', type: 'integer' })
  odeNavStructureSyncId: number;

  @ManyToOne(
    () => OdeNavStructureSync,
    (odeNavStructureSync) => odeNavStructureSync.odePagStructureSyncs,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'ode_nav_structure_sync_id' })
  odeNavStructureSync: OdeNavStructureSync;

  // Properties for this block
  @OneToMany(
    () => OdePagStructureSyncProperties,
    (properties) => properties.odePagStructureSync,
    { cascade: ['insert', 'update', 'remove'], eager: true },
  )
  odePagStructureSyncProperties: OdePagStructureSyncProperties[];

  @OneToMany(
    () => OdeComponentsSync,
    (odeComponentsSync) => odeComponentsSync.odePagStructureSync,
    { cascade: ['insert', 'update', 'remove'] },
  )
  odeComponentsSyncs: OdeComponentsSync[];

  /**
   * Get max order value among sibling blocks
   */
  getMaxOrder(): number | null {
    // This requires access to all siblings via the parent page
    // Implementation would need to be done in the service layer
    return null;
  }
}

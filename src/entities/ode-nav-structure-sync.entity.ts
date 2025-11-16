import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { OdeNavStructureSyncProperties } from './ode-nav-structure-sync-properties.entity';
import { OdePagStructureSync } from './ode-pag-structure-sync.entity';

/**
 * OdeNavStructureSync entity
 * Represents pages in the hierarchical navigation structure
 *
 * This entity manages:
 * - Page hierarchy (parent-child relationships)
 * - Page ordering within the navigation tree
 * - Page properties (via OdeNavStructureSyncProperties)
 * - Page content blocks (via OdePagStructureSync)
 */
@Entity('ode_nav_structure_sync')
@Index('fk_ode_nav_structure_sync_1_idx', ['odeNavStructureSyncId'])
export class OdeNavStructureSync extends BaseEntity {
  @Column({ name: 'ode_session_id', type: 'varchar', length: 20 })
  odeSessionId: string;

  @Column({ name: 'ode_page_id', type: 'varchar', length: 20 })
  odePageId: string;

  @Column({ name: 'page_name', type: 'varchar', length: 255 })
  pageName: string;

  @Column({ name: 'ode_nav_structure_sync_order', type: 'integer' })
  odeNavStructureSyncOrder: number;

  @Column({ name: 'ode_parent_page_id', type: 'varchar', length: 20, nullable: true })
  odeParentPageId: string | null;

  // Self-referencing relationship - parent page
  @Column({ name: 'ode_nav_structure_sync_id', type: 'integer', nullable: true })
  odeNavStructureSyncId: number | null;

  @ManyToOne(
    () => OdeNavStructureSync,
    (odeNavStructureSync) => odeNavStructureSync.odeNavStructureSyncs,
    { onDelete: 'CASCADE', nullable: true },
  )
  @JoinColumn({ name: 'ode_nav_structure_sync_id' })
  odeNavStructureSync: OdeNavStructureSync | null;

  // Self-referencing relationship - child pages
  @OneToMany(
    () => OdeNavStructureSync,
    (odeNavStructureSync) => odeNavStructureSync.odeNavStructureSync,
    { cascade: ['insert', 'update', 'remove'] },
  )
  odeNavStructureSyncs: OdeNavStructureSync[];

  // Properties for this page
  @OneToMany(
    () => OdeNavStructureSyncProperties,
    (properties) => properties.odeNavStructureSync,
    { cascade: ['insert', 'update', 'remove'], eager: true },
  )
  odeNavStructureSyncProperties: OdeNavStructureSyncProperties[];

  // Page structure/blocks
  @OneToMany(
    () => OdePagStructureSync,
    (odePagStructureSync) => odePagStructureSync.odeNavStructureSync,
    { cascade: ['insert', 'update', 'remove'] },
  )
  odePagStructureSyncs: OdePagStructureSync[];

  /**
   * Check if this is the index (first) page
   * Index page has no parent and order = 1
   */
  isIndex(): boolean {
    return !this.odeParentPageId && this.odeNavStructureSyncOrder === 1;
  }

  /**
   * Get the titleNode property value (page title)
   */
  getTitle(): string | null {
    const titleProp = this.odeNavStructureSyncProperties?.find((prop) =>
      prop.isTitleNode(),
    );
    return titleProp?.value || null;
  }
}

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OdeNavStructureSync } from './ode-nav-structure-sync.entity';

/**
 * OdeNavStructureSyncProperties entity
 * Stores configurable properties for navigation structure pages
 *
 * This entity manages key-value pairs for page-level configuration:
 * - titleNode: Page title
 * - Other configurable page properties
 */
@Entity('ode_nav_structure_sync_properties')
@Index('fk_ode_nav_structure_sync_properties_1_idx', ['odeNavStructureSyncId'])
export class OdeNavStructureSyncProperties extends BaseEntity {
  @Column({
    name: 'ode_nav_structure_sync_properties_key',
    type: 'varchar',
    length: 255,
  })
  key: string;

  @Column({
    name: 'ode_nav_structure_sync_properties_value',
    type: 'text',
  })
  value: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'ode_nav_structure_sync_id', type: 'integer' })
  odeNavStructureSyncId: number;

  @ManyToOne(
    () => OdeNavStructureSync,
    (odeNavStructureSync) => odeNavStructureSync.odeNavStructureSyncProperties,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'ode_nav_structure_sync_id' })
  odeNavStructureSync: OdeNavStructureSync;

  /**
   * Checks if this property is the titleNode property
   */
  isTitleNode(): boolean {
    return this.key === 'titleNode';
  }
}

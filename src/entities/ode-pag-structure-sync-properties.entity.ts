import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OdePagStructureSync } from './ode-pag-structure-sync.entity';

/**
 * OdePagStructureSyncProperties entity
 * Stores configurable properties for page content blocks
 *
 * This entity manages key-value pairs for block-level configuration:
 * - Heritable properties (inherited from page-level properties)
 * - Block-specific configuration
 */
@Entity('ode_pag_structure_sync_properties')
@Index('fk_ode_pag_structure_sync_properties_1_idx', ['odePagStructureSyncId'])
export class OdePagStructureSyncProperties extends BaseEntity {
  @Column({
    name: 'ode_pag_structure_sync_properties_key',
    type: 'varchar',
    length: 255,
  })
  key: string;

  @Column({
    name: 'ode_pag_structure_sync_properties_value',
    type: 'text',
  })
  value: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'heritable', type: 'boolean', default: false })
  heritable: boolean;

  @Column({ name: 'ode_pag_structure_sync_id', type: 'integer' })
  odePagStructureSyncId: number;

  @ManyToOne(
    () => OdePagStructureSync,
    (odePagStructureSync) => odePagStructureSync.odePagStructureSyncProperties,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'ode_pag_structure_sync_id' })
  odePagStructureSync: OdePagStructureSync;

  /**
   * Check if this property can be inherited from parent page
   */
  isHeritable(): boolean {
    return this.heritable;
  }
}

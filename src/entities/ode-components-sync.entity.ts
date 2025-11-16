import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { OdePagStructureSync } from './ode-pag-structure-sync.entity';
import { OdeComponentsSyncProperties } from './ode-components-sync-properties.entity';

/**
 * OdeComponentsSync entity
 * Represents iDevice components within content blocks
 *
 * This entity manages:
 * - Component metadata (iDevice type, name, IDs)
 * - Component content (HTML view, JSON properties)
 * - Component ordering within blocks
 * - Component properties (via OdeComponentsSyncProperties)
 * - Associated block (via OdePagStructureSync)
 */
@Entity('ode_components_sync')
@Index('fk_ode_components_sync_1_idx', ['odePagStructureSyncId'])
export class OdeComponentsSync extends BaseEntity {
  @Column({ name: 'ode_session_id', type: 'varchar', length: 20 })
  odeSessionId: string;

  @Column({ name: 'ode_page_id', type: 'varchar', length: 20 })
  odePageId: string;

  @Column({ name: 'ode_block_id', type: 'varchar', length: 20 })
  odeBlockId: string;

  @Column({ name: 'ode_idevice_id', type: 'varchar', length: 20 })
  odeIdeviceId: string;

  @Column({ name: 'ode_idevice_type_name', type: 'varchar', length: 255 })
  odeIdeviceTypeName: string;

  @Column({ name: 'html_view', type: 'text', nullable: true })
  htmlView: string | null;

  @Column({ name: 'json_properties', type: 'text', nullable: true })
  jsonProperties: string | null;

  @Column({ name: 'ode_components_sync_order', type: 'integer' })
  odeComponentsSyncOrder: number;

  @Column({ name: 'ode_pag_structure_sync_id', type: 'integer' })
  odePagStructureSyncId: number;

  @ManyToOne(
    () => OdePagStructureSync,
    (odePagStructureSync) => odePagStructureSync.odeComponentsSyncs,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'ode_pag_structure_sync_id' })
  odePagStructureSync: OdePagStructureSync;

  @OneToMany(
    () => OdeComponentsSyncProperties,
    (properties) => properties.odeComponentsSync,
    { cascade: ['insert', 'update', 'remove'], eager: true },
  )
  odeComponentsSyncProperties: OdeComponentsSyncProperties[];

  /**
   * Get max order value among sibling components
   */
  getMaxOrder(): number | null {
    // This requires access to all siblings via the parent block
    // Implementation would need to be done in the service layer
    return null;
  }
}

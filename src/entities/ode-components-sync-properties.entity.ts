import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OdeComponentsSync } from './ode-components-sync.entity';

/**
 * OdeComponentsSyncProperties entity
 * Stores configurable properties for iDevice components
 *
 * This entity manages key-value pairs for component-level configuration.
 * Properties can be heritable from parent block/page properties.
 */
@Entity('ode_components_sync_properties')
@Index('fk_ode_components_sync_properties_1_idx', ['odeComponentsSyncId'])
export class OdeComponentsSyncProperties extends BaseEntity {
  @Column({
    name: 'ode_components_sync_properties_key',
    type: 'varchar',
    length: 255,
  })
  key: string;

  @Column({
    name: 'ode_components_sync_properties_value',
    type: 'text',
  })
  value: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'ode_components_sync_id', type: 'integer' })
  odeComponentsSyncId: number;

  @ManyToOne(
    () => OdeComponentsSync,
    (odeComponentsSync) => odeComponentsSync.odeComponentsSyncProperties,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'ode_components_sync_id' })
  odeComponentsSync: OdeComponentsSync;
}

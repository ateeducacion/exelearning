import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * OdePropertiesSync entity
 * Stores project/ODE properties as key-value pairs per session
 *
 * Note: odeSessionId is stored as a string (not a foreign key) for flexibility
 * This matches the Symfony implementation
 */
@Entity('ode_properties_sync')
@Index('fk_ode_properties_1_idx', ['odeSessionId'])
export class OdePropertiesSync extends BaseEntity {
  @Column({ name: 'ode_session_id', type: 'varchar', length: 20 })
  odeSessionId: string;

  @Column({ name: 'key', type: 'varchar', length: 255 })
  key: string;

  @Column({ name: 'value', type: 'text' })
  value: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;
}

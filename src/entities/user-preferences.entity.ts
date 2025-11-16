import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * UserPreferences entity
 * Stores user preferences as key-value pairs
 *
 * Note: userId is stored as a string (not a foreign key) for flexibility
 * This matches the Symfony implementation
 */
@Entity('user_preferences')
@Index('fk_user_preferences_1_idx', ['userId'])
export class UserPreferences extends BaseEntity {
  @Column({ name: 'user_id', type: 'varchar', length: 255 })
  userId: string;

  @Column({ name: 'key', type: 'varchar', length: 255 })
  key: string;

  @Column({ name: 'value', type: 'text' })
  value: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;
}

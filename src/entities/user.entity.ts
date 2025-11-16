import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'email', type: 'varchar', length: 180, unique: true })
  email: string;

  @Column({ name: 'user_id', type: 'varchar', length: 40 })
  userId: string;

  @Column({ name: 'password', type: 'varchar' })
  password: string;

  @Column({ name: 'roles', type: 'simple-json' })
  roles: string[];

  @Column({ name: 'is_lopd_accepted', type: 'boolean', default: false })
  isLopdAccepted: boolean;

  @Column({ name: 'quota_mb', type: 'integer', nullable: true })
  quotaMb: number | null;

  @Column({
    name: 'external_identifier',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  externalIdentifier: string | null;

  @Column({ name: 'api_token', type: 'varchar', length: 255, nullable: true })
  apiToken: string | null;

  @Column({ name: 'created_at', type: 'datetime', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  // Virtual property - not in database
  getGravatarUrl(): string {
    // For now, return empty string. Will implement later if needed
    return '';
  }

  getUsername(): string {
    return this.email;
  }

  getUserIdentifier(): string {
    return this.email;
  }
}

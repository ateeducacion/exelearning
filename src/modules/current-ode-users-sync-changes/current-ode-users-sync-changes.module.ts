import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentOdeUsersSyncChanges } from '../../entities/current-ode-users-sync-changes.entity';
import { CurrentOdeUsersSyncChangesService } from './current-ode-users-sync-changes.service';

/**
 * CurrentOdeUsersSyncChangesModule
 * Manages pending synchronization changes made by users
 */
@Module({
  imports: [TypeOrmModule.forFeature([CurrentOdeUsersSyncChanges])],
  providers: [CurrentOdeUsersSyncChangesService],
  exports: [CurrentOdeUsersSyncChangesService, TypeOrmModule],
})
export class CurrentOdeUsersSyncChangesModule {}

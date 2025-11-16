import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdePropertiesSync } from '../../entities/ode-properties-sync.entity';
import { OdePropertiesSyncService } from './ode-properties-sync.service';

/**
 * OdePropertiesSyncModule
 * Manages ODE/project properties (key-value store per session)
 */
@Module({
  imports: [TypeOrmModule.forFeature([OdePropertiesSync])],
  providers: [OdePropertiesSyncService],
  exports: [OdePropertiesSyncService, TypeOrmModule],
})
export class OdePropertiesSyncModule {}

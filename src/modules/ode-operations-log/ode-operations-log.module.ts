import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdeOperationsLog } from '../../entities/ode-operations-log.entity';
import { OdeOperationsLogService } from './ode-operations-log.service';

/**
 * OdeOperationsLogModule
 * Manages audit logging of operations performed on ODE projects
 */
@Module({
  imports: [TypeOrmModule.forFeature([OdeOperationsLog])],
  providers: [OdeOperationsLogService],
  exports: [OdeOperationsLogService, TypeOrmModule],
})
export class OdeOperationsLogModule {}

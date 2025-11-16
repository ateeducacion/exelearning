import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdeFiles } from '../../entities/ode-files.entity';
import { OdeFilesService } from './ode-files.service';

/**
 * OdeFilesModule
 * Manages file metadata for ODE projects
 */
@Module({
  imports: [TypeOrmModule.forFeature([OdeFiles])],
  providers: [OdeFilesService],
  exports: [OdeFilesService, TypeOrmModule],
})
export class OdeFilesModule {}

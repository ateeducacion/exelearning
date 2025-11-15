import { Module } from '@nestjs/common';
import { OdeExportController } from './ode-export.controller';
import { OdeExportService } from './ode-export.service';

@Module({
  controllers: [OdeExportController],
  providers: [OdeExportService],
  exports: [OdeExportService]
})
export class OdeExportModule {}

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileManagementModule } from '../file-management/file-management.module';
import { ProjectModule } from '../project/project.module';
import { Html5ExportService } from './services/html5-export.service';

@Module({
  imports: [ConfigModule, FileManagementModule, forwardRef(() => ProjectModule)],
  providers: [Html5ExportService],
  exports: [Html5ExportService],
})
export class ExportModule {}

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileManagementModule } from '../file-management/file-management.module';
import { XmlModule } from '../xml/xml.module';
import { ExportModule } from '../export/export.module';
import { ProjectOpenService } from './services/project-open.service';
import { ProjectController } from './controllers/project.controller';

@Module({
  imports: [ConfigModule, FileManagementModule, XmlModule, forwardRef(() => ExportModule)],
  controllers: [ProjectController],
  providers: [ProjectOpenService],
  exports: [ProjectOpenService],
})
export class ProjectModule {}

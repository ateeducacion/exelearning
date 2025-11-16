import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZipService } from './services/zip.service';
import { FileHelperService } from './services/file-helper.service';

@Module({
  imports: [ConfigModule],
  providers: [ZipService, FileHelperService],
  exports: [ZipService, FileHelperService],
})
export class FileManagementModule {}

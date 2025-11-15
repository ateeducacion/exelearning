import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { OdeExportService } from './ode-export.service';
import { OdeExportDownloadParamsDto } from './dto/ode-export-download-params.dto';
import { OdeExportPreviewParamsDto } from './dto/ode-export-preview-params.dto';
import { OdeExportResponseDto } from './dto/ode-export-response.dto';
import { OdeExportFileRequestDto } from './dto/ode-export-file-request.dto';

@Controller({ path: 'ode-export', version: '2' })
export class OdeExportController {
  constructor(private readonly odeExportService: OdeExportService) {}

  @Get(':odeSessionId/:exportType/download')
  async download(@Param() params: OdeExportDownloadParamsDto): Promise<OdeExportResponseDto> {
    return this.odeExportService.generateDownload(params.odeSessionId, params.exportType);
  }

  @Get(':odeSessionId/preview')
  async preview(@Param() params: OdeExportPreviewParamsDto): Promise<OdeExportResponseDto> {
    return this.odeExportService.generatePreview(params.odeSessionId);
  }

  @Get('files/tmp/:relativePath(*)')
  async getFile(
    @Param() params: OdeExportFileRequestDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const file = await this.odeExportService.openArtifact(params.relativePath);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);

    return new StreamableFile(file.stream);
  }
}

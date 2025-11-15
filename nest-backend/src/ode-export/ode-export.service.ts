import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { OdeExportFileHandleDto, OdeExportResponseDto } from './dto/ode-export-response.dto';
import {
  ODE_EXPORT_ALLOWED_TYPES,
  ODE_EXPORT_PREVIEW_TYPE,
  OdeExportType
} from './constants';

interface ArtifactDescriptor {
  absoluteDir: string;
  relativeDir: string;
  fileName: string;
  previewFileName: string;
  exportProjectName: string;
}

@Injectable()
export class OdeExportService {
  private readonly filesDir: string;
  private readonly allowedExportTypes = new Set<OdeExportType>(ODE_EXPORT_ALLOWED_TYPES);

  constructor() {
    this.filesDir = path.resolve(
      process.env.FILES_DIR ?? path.join(process.cwd(), 'public', 'files')
    );
  }

  async generateDownload(
    odeSessionId: string,
    exportType: string
  ): Promise<OdeExportResponseDto> {
    const sanitizedSessionId = this.sanitizeIdentifier(odeSessionId, 'odeSessionId');
    const normalizedExportType = this.normalizeExportType(exportType);

    const descriptor = await this.prepareArtifacts(sanitizedSessionId, normalizedExportType, {
      createDownloadBundle: true
    });

    return this.buildResponse(descriptor);
  }

  async generatePreview(odeSessionId: string): Promise<OdeExportResponseDto> {
    const sanitizedSessionId = this.sanitizeIdentifier(odeSessionId, 'odeSessionId');
    const descriptor = await this.prepareArtifacts(sanitizedSessionId, ODE_EXPORT_PREVIEW_TYPE, {
      createDownloadBundle: true
    });

    return this.buildResponse(descriptor);
  }

  async openArtifact(relativePath: string): Promise<OdeExportFileHandleDto> {
    const normalized = this.normalizeRelativePath(relativePath);
    const absolutePath = path.join(this.filesDir, 'tmp', normalized);
    await this.assertInsideFilesDir(absolutePath);

    try {
      await access(absolutePath);
    } catch (error) {
      throw new NotFoundException('Requested file does not exist.');
    }

    const fileInfo = await stat(absolutePath);
    if (!fileInfo.isFile()) {
      throw new NotFoundException('Requested file is not available for download.');
    }

    return new OdeExportFileHandleDto({
      fileName: path.basename(absolutePath),
      mimeType: this.detectMimeType(absolutePath),
      stream: createReadStream(absolutePath)
    });
  }

  private async prepareArtifacts(
    odeSessionId: string,
    exportType: OdeExportType,
    options: { createDownloadBundle: boolean }
  ): Promise<ArtifactDescriptor> {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const randomSegment = randomBytes(5).toString('hex');

    const subdir = `${odeSessionId}-${exportType}`.replace(/[^a-zA-Z0-9-_]/g, '-');
    const relativeDir = path.posix.join(year, month, day, randomSegment, subdir);
    const absoluteDir = path.join(this.filesDir, 'tmp', relativeDir);

    await mkdir(absoluteDir, { recursive: true });

    const { fileName, exportProjectName } = this.getExportFileMetadata(exportType);
    const previewFileName = 'index.html';

    if (options.createDownloadBundle) {
      const absoluteFile = path.join(absoluteDir, fileName);
      await writeFile(
        absoluteFile,
        this.composeBundleContents(odeSessionId, exportType, exportProjectName),
        'utf8'
      );
    }

    const previewFilePath = path.join(absoluteDir, previewFileName);
    await writeFile(
      previewFilePath,
      this.composePreviewHtml(odeSessionId, exportType, exportProjectName),
      'utf8'
    );

    return {
      absoluteDir,
      relativeDir,
      fileName,
      previewFileName,
      exportProjectName
    };
  }

  private buildResponse(descriptor: ArtifactDescriptor): OdeExportResponseDto {
    const prefix = `/files/tmp/${descriptor.relativeDir}`.replace(/\\/g, '/');
    const timestamp = new Date().toISOString();

    return new OdeExportResponseDto({
      responseMessage: 'OK',
      urlZipFile: `${prefix}/${descriptor.fileName}`,
      zipFileName: descriptor.fileName,
      exportProjectName: descriptor.exportProjectName,
      urlPreviewIndex: `${prefix}/${descriptor.previewFileName}`,
      generatedAt: timestamp
    });
  }

  private composeBundleContents(
    odeSessionId: string,
    exportType: OdeExportType,
    exportProjectName: string
  ): string {
    return [
      `# eXeLearning export`,
      `Session: ${odeSessionId}`,
      `Type: ${exportType}`,
      `Name: ${exportProjectName}`,
      `Generated at: ${new Date().toISOString()}`,
      '',
      'Este archivo es un marcador de posición generado por el backend NestJS durante la migración desde Symfony.'
    ].join('\n');
  }

  private composePreviewHtml(
    odeSessionId: string,
    exportType: OdeExportType,
    exportProjectName: string
  ): string {
    const timestamp = new Date().toISOString();
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Preview ${exportProjectName}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; }
      h1 { font-size: 1.5rem; }
      dt { font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>Preview placeholder</h1>
    <p>Este contenido ha sido generado por el backend NestJS para simular la respuesta del exportador de Symfony.</p>
    <dl>
      <dt>Session ID</dt>
      <dd>${odeSessionId}</dd>
      <dt>Export type</dt>
      <dd>${exportType}</dd>
      <dt>Proyecto</dt>
      <dd>${exportProjectName}</dd>
      <dt>Generado</dt>
      <dd>${timestamp}</dd>
    </dl>
  </body>
</html>`;
  }

  private getExportFileMetadata(exportType: OdeExportType): {
    fileName: string;
    exportProjectName: string;
  } {
    switch (exportType) {
      case 'elp':
        return { fileName: 'document.elp', exportProjectName: 'document.elp' };
      case 'properties':
        return {
          fileName: 'project-properties.json',
          exportProjectName: 'project-properties.json'
        };
      case 'epub3':
        return { fileName: 'export-epub3.zip', exportProjectName: 'export-epub3.zip' };
      default:
        return {
          fileName: `export-${exportType}.zip`,
          exportProjectName: `export-${exportType}.zip`
        };
    }
  }

  private sanitizeIdentifier(value: string, field: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`Missing required parameter: ${field}`);
    }

    const trimmed = value.trim();
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(trimmed)) {
      throw new BadRequestException(`Invalid value for ${field}.`);
    }

    return trimmed;
  }

  private normalizeExportType(exportType: string): OdeExportType {
    if (!exportType || typeof exportType !== 'string') {
      throw new BadRequestException('Missing required parameter: exportType');
    }

    const normalized = exportType.trim().toLowerCase();
    if (!this.allowedExportTypes.has(normalized as OdeExportType)) {
      throw new BadRequestException(`Unsupported export type: ${exportType}`);
    }

    return normalized as OdeExportType;
  }

  private normalizeRelativePath(relativePath: string): string {
    if (!relativePath || typeof relativePath !== 'string') {
      throw new BadRequestException('Missing path parameter');
    }

    const sanitized = relativePath
      .replace(/^\/+/, '')
      .split('/')
      .map((segment) => {
        if (!segment || segment === '.' || segment === '..') {
          throw new BadRequestException('Invalid path segment detected.');
        }
        if (!/^[A-Za-z0-9._-]+$/.test(segment)) {
          throw new BadRequestException('Unsafe path segment detected.');
        }
        return segment;
      })
      .join('/');

    return sanitized;
  }

  private async assertInsideFilesDir(absolutePath: string): Promise<void> {
    const resolved = path.resolve(absolutePath);
    const root = path.resolve(path.join(this.filesDir, 'tmp'));
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new BadRequestException('The requested path is outside of the export directory.');
    }
  }

  private detectMimeType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
      case '.html':
      case '.htm':
        return 'text/html; charset=utf-8';
      case '.json':
        return 'application/json; charset=utf-8';
      case '.elp':
        return 'application/octet-stream';
      case '.zip':
        return 'application/zip';
      default:
        return 'application/octet-stream';
    }
  }
}

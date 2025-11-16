import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { FileInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { Express, Request } from 'express';
import { ProjectOpenService } from '../services/project-open.service';
import { Html5ExportService } from '../../export/services/html5-export.service';
import * as fs from 'fs-extra';
import * as path from 'path';

@Controller('api/project')
export class ProjectController {
  constructor(
    private readonly projectOpenService: ProjectOpenService,
    private readonly html5ExportService: Html5ExportService,
  ) {}

  /**
   * Open an ELP file
   * POST /api/project/open
   * Supports both regular uploads (field: 'file') and chunked uploads (field: 'odeFilePart')
   */
  @Post('open')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AnyFilesInterceptor())
  async openElpFile(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: any,
    @Req() req: Request,
  ) {
    // Get file from either 'file' or 'odeFilePart' field
    const uploadedFile = files?.find(
      (f) => f.fieldname === 'file' || f.fieldname === 'odeFilePart',
    );

    if (!uploadedFile) {
      throw new BadRequestException('No file uploaded');
    }

    // Get filename from body if provided (for chunked uploads)
    const fileName =
      body.odeFileName?.[0] || body.odeFileName || uploadedFile.originalname;

    // Save uploaded file temporarily
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.ensureDir(tempDir);
    const tempFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);

    try {
      await fs.writeFile(tempFilePath, uploadedFile.buffer);

      // Open the ELP file
      const result = await this.projectOpenService.openElpFile(tempFilePath, {
        validateXml: true,
      });

      // Return response in format expected by frontend
      // Frontend expects 'responseMessage' field
      return {
        responseMessage: 'OK',
        success: true,
        data: {
          sessionId: result.odeSessionId,
          structure: result.structure,
          sessionPath: result.sessionPath,
          contentPath: result.contentPath,
        },
      };
    } catch (error) {
      // Return error in format expected by frontend
      return {
        responseMessage: `error: ${error.message}`,
        success: false,
      };
    } finally {
      // Cleanup temp file
      await fs.remove(tempFilePath);
    }
  }

  /**
   * Export a session to HTML5
   * POST /api/project/export
   */
  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportToHtml5(@Body() body: { sessionId: string; options?: any }) {
    if (!body.sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    const result = await this.html5ExportService.exportToHtml5(
      body.sessionId,
      body.options || {},
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * List all active sessions
   * GET /api/project/sessions
   */
  @Get('sessions')
  async listSessions() {
    const sessions = this.projectOpenService.listActiveSessions();

    const sessionsData = sessions.map((sessionId) => {
      const session = this.projectOpenService.getSession(sessionId);
      return {
        sessionId,
        created: session?.created,
        modified: session?.modified,
        title: session?.structure.meta.title,
        pageCount: session?.structure.pages.length,
      };
    });

    return {
      success: true,
      data: sessionsData,
    };
  }

  /**
   * Get a specific session
   * GET /api/project/sessions/:id
   */
  @Get('sessions/:id')
  async getSession(@Param('id') sessionId: string) {
    const session = this.projectOpenService.getSession(sessionId);

    if (!session) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    return {
      success: true,
      data: {
        sessionId: session.odeSessionId,
        created: session.created,
        modified: session.modified,
        structure: session.structure,
        sessionPath: session.sessionPath,
      },
    };
  }

  /**
   * Close a session
   * DELETE /api/project/sessions/:id
   */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async closeSession(
    @Param('id') sessionId: string,
    @Body() body?: { save?: boolean },
  ) {
    await this.projectOpenService.closeSession(sessionId, body?.save || false);

    return {
      success: true,
      message: `Session ${sessionId} closed successfully`,
    };
  }

  /**
   * Get a file from a session
   * GET /api/project/sessions/:id/files/:filePath
   */
  @Get('sessions/:id/files/*')
  async getSessionFile(
    @Param('id') sessionId: string,
    @Param() params: any,
  ) {
    // Extract file path from remaining params
    const filePath = params[0] || '';

    const fileBuffer = await this.projectOpenService.getSessionFile(
      sessionId,
      filePath,
    );

    if (!fileBuffer) {
      throw new NotFoundException(`File not found: ${filePath}`);
    }

    return fileBuffer;
  }

  /**
   * Get user ODE files list
   * GET /api/project/get/user/ode/list
   *
   * TODO: This is a stub implementation. Full implementation requires:
   * - Database integration with OdeFiles entity
   * - User authentication to get current user
   * - File disk space calculations
   */
  @Get('get/user/ode/list')
  async getUserOdeList() {
    // Stub implementation - return empty list
    // This prevents the frontend JavaScript error while we work on full migration
    return {
      odeFiles: [],
    };
  }
}

import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { OdeExportService } from './ode-export.service';

async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

describe('OdeExportService', () => {
  let tmpDir: string;
  let service: OdeExportService;
  const originalFilesDir = process.env.FILES_DIR;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ode-export-service-'));
    process.env.FILES_DIR = tmpDir;
    service = new OdeExportService();
  });

  afterAll(async () => {
    if (originalFilesDir === undefined) {
      delete process.env.FILES_DIR;
    } else {
      process.env.FILES_DIR = originalFilesDir;
    }
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('generates export bundles with downloadable artifacts', async () => {
    const response = await service.generateDownload('sessionABC', 'html5');

    expect(response.responseMessage).toBe('OK');
    expect(response.zipFileName).toBe('export-html5.zip');
    expect(response.urlZipFile).toMatch(/^\/files\/tmp\//);

    const relative = response.urlZipFile.replace(/^\/files\/tmp\//, '');
    const fileHandle = await service.openArtifact(relative);
    const contents = await streamToString(fileHandle.stream);

    expect(fileHandle.mimeType).toBe('application/zip');
    expect(contents).toContain('Session: sessionABC');
    expect(contents).toContain('Type: html5');
  });

  it('exposes preview html documents', async () => {
    const response = await service.generatePreview('sessionXYZ');

    expect(response.urlPreviewIndex).toMatch(/^\/files\/tmp\//);
    const relativePreview = response.urlPreviewIndex.replace(/^\/files\/tmp\//, '');
    const previewHandle = await service.openArtifact(relativePreview);
    const html = await streamToString(previewHandle.stream);

    expect(previewHandle.mimeType).toContain('text/html');
    expect(html).toContain('sessionXYZ');
    expect(html).toContain('Preview placeholder');
  });

  it('rejects unsupported export types', async () => {
    await expect(service.generateDownload('session123', 'invalid-type')).rejects.toThrow(
      /Unsupported export type/
    );
  });
});

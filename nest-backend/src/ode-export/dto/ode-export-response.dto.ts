export class OdeExportResponseDto {
  responseMessage!: 'OK' | string;
  urlZipFile!: string;
  zipFileName!: string;
  exportProjectName!: string;
  urlPreviewIndex!: string;
  generatedAt!: string;

  constructor(init: Partial<OdeExportResponseDto>) {
    Object.assign(this, init);
  }
}

export class OdeExportFileHandleDto {
  fileName!: string;
  mimeType!: string;
  stream!: NodeJS.ReadableStream;

  constructor(init: Partial<OdeExportFileHandleDto>) {
    Object.assign(this, init);
  }
}

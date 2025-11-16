/**
 * Export format types
 */
export enum ExportFormat {
  HTML5 = 'html5',
  SCORM12 = 'scorm12',
  SCORM2004 = 'scorm2004',
  EPUB3 = 'epub3',
}

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  includeResources?: boolean;
  compressionLevel?: number;
  templateName?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  format: ExportFormat;
}

/**
 * HTML5 export specific options
 */
export interface Html5ExportOptions {
  includeNavigation?: boolean;
  responsive?: boolean;
  theme?: string;
  customCss?: string;
}

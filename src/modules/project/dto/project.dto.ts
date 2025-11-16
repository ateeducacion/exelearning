import { ParsedOdeStructure } from '../../xml/interfaces/ode-xml.interface';

/**
 * Result of opening an ELP file
 */
export interface OpenElpResult {
  odeSessionId: string;
  structure: ParsedOdeStructure;
  sessionPath: string;
  contentPath: string;
}

/**
 * Project session information
 */
export interface ProjectSession {
  odeSessionId: string;
  created: Date;
  modified: Date;
  structure: ParsedOdeStructure;
  sessionPath: string;
  contentPath: string;
}

/**
 * Options for opening ELP files
 */
export interface OpenElpOptions {
  overwrite?: boolean;
  preserveStructure?: boolean;
  validateXml?: boolean;
}

/**
 * Options for saving projects
 */
export interface SaveProjectOptions {
  compressionLevel?: number;
  includeBackup?: boolean;
}

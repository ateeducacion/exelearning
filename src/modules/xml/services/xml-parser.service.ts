import { Injectable, Logger } from '@nestjs/common';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import * as fs from 'fs-extra';
import {
  OdeXmlDocument,
  OdeXmlMeta,
  OdeXmlNavigation,
  OdeXmlPage,
  OdeXmlComponent,
  NormalizedPage,
  ParsedOdeStructure,
  LegacyXmlFormat,
  RealOdeXmlDocument,
  RealOdeNavStructure,
  RealOdePagStructure,
  RealOdeComponent,
} from '../interfaces/ode-xml.interface';

export interface XmlParseOptions {
  preserveOrder?: boolean;
  ignoreAttributes?: boolean;
  parseTagValue?: boolean;
  trimValues?: boolean;
}

@Injectable()
export class XmlParserService {
  private readonly logger = new Logger(XmlParserService.name);
  private readonly parser: XMLParser;

  constructor() {
    // Configure fast-xml-parser with appropriate options
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
      cdataPropName: '__cdata',
      ignoreDeclaration: true,
      ignorePiTags: true,
      commentPropName: false, // Ignore comments
      allowBooleanAttributes: true,
    });
  }

  /**
   * Parse ODE XML from file
   * @param xmlPath Path to XML file
   * @returns Parsed ODE structure
   */
  async parseFromFile(xmlPath: string): Promise<ParsedOdeStructure> {
    try {
      this.logger.debug(`Parsing XML file: ${xmlPath}`);

      // Read file content
      if (!(await fs.pathExists(xmlPath))) {
        throw new Error(`XML file not found: ${xmlPath}`);
      }

      const xmlContent = await fs.readFile(xmlPath, 'utf-8');
      return this.parseFromString(xmlContent);
    } catch (error) {
      this.logger.error(`Failed to parse XML file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Parse ODE XML from string
   * @param xmlContent XML content as string
   * @returns Parsed ODE structure
   */
  parseFromString(xmlContent: string): ParsedOdeStructure {
    try {
      this.logger.debug('Parsing XML from string');

      // Parse XML
      const parsed = this.parser.parse(xmlContent);

      // Debug logging
      this.logger.debug(`Parsed object keys: ${JSON.stringify(Object.keys(parsed))}`);
      this.logger.debug(`Has ode: ${!!parsed.ode}, Has exe_document: ${!!parsed.exe_document}`);

      // Check if it's the real ODE format
      if (parsed.ode) {
        this.logger.debug('Detected real ODE XML format');
        return this.parseRealOdeFormat(parsed as RealOdeXmlDocument);
      }

      // Check if it's the exe_document format
      if (parsed.exe_document) {
        this.logger.debug('Detected exe_document XML format');
        return this.parseExeDocumentFormat(parsed as OdeXmlDocument);
      }

      this.logger.error(`XML parsing failed. Object: ${JSON.stringify(parsed, null, 2).substring(0, 500)}`);
      throw new Error('Invalid ODE XML: Missing ode or exe_document root element');
    } catch (error) {
      this.logger.error(`Failed to parse XML string: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Parse exe_document format
   * @param parsed Parsed XML document
   * @returns Parsed ODE structure
   */
  private parseExeDocumentFormat(parsed: OdeXmlDocument): ParsedOdeStructure {
    // Extract metadata
    const meta = this.extractMetadata(parsed.exe_document.meta || {});

    // Extract and normalize pages
    const pages = this.normalizePagesFromNavigation(
      parsed.exe_document.navigation,
    );

    this.logger.log(`Parsed ${pages.length} pages from exe_document XML`);

    return {
      meta,
      pages,
      navigation: parsed.exe_document.navigation,
    };
  }

  /**
   * Parse real ODE format (from actual ELP files)
   * @param parsed Parsed real ODE document
   * @returns Parsed ODE structure
   */
  private parseRealOdeFormat(parsed: RealOdeXmlDocument): ParsedOdeStructure {
    // Extract metadata from odeProperties
    const meta = this.extractMetadataFromOdeProperties(
      parsed.ode.odeProperties?.odeProperty || [],
    );

    // Extract and normalize pages from odeNavStructures
    const pages = this.normalizePagesFromOdeNavStructures(
      parsed.ode.odeNavStructures?.odeNavStructure || [],
    );

    this.logger.log(`Parsed ${pages.length} pages from real ODE XML`);

    // Create a mock navigation structure for compatibility
    const navigation: OdeXmlNavigation = { page: [] };

    return {
      meta,
      pages,
      navigation,
    };
  }

  /**
   * Extract metadata from XML
   * @param metaData Raw metadata object
   * @returns Normalized metadata
   */
  private extractMetadata(metaData: any): OdeXmlMeta {
    return {
      author: String(metaData.author || ''),
      title: String(metaData.title || ''),
      description: String(metaData.description || ''),
      language: String(metaData.language || 'en'),
      license: String(metaData.license || ''),
      keywords: String(metaData.keywords || ''),
      taxonomy: String(metaData.taxonomy || ''),
      aggregationLevel: String(metaData.aggregationLevel || ''),
      structure: String(metaData.structure || ''),
      semanticDensity: String(metaData.semanticDensity || ''),
      difficulty: String(metaData.difficulty || ''),
      typicalLearningTime: String(metaData.typicalLearningTime || ''),
      context: String(metaData.context || ''),
      endUser: String(metaData.endUser || ''),
      interactivityType: String(metaData.interactivityType || ''),
      interactivityLevel: String(metaData.interactivityLevel || ''),
      cognitiveProcess: String(metaData.cognitiveProcess || ''),
      intendedEducationalUse: String(metaData.intendedEducationalUse || ''),
      version: metaData.version !== undefined && metaData.version !== null
        ? (typeof metaData.version === 'number'
           ? metaData.version.toFixed(1)  // Convert 3 to "3.0"
           : String(metaData.version))
        : '1.0',
      exelearning_version: String(metaData.exelearning_version || ''),
      created: String(metaData.created || new Date().toISOString()),
      modified: String(metaData.modified || new Date().toISOString()),
    };
  }

  /**
   * Normalize pages from navigation tree into flat array
   * @param navigation Navigation structure
   * @returns Array of normalized pages
   */
  private normalizePagesFromNavigation(
    navigation: OdeXmlNavigation,
  ): NormalizedPage[] {
    const pages: NormalizedPage[] = [];

    if (!navigation || !navigation.page) {
      this.logger.warn('Navigation structure is empty');
      return pages;
    }

    // Handle single page or array of pages
    const rootPages = Array.isArray(navigation.page)
      ? navigation.page
      : [navigation.page];

    // Recursively process pages
    rootPages.forEach((page, index) => {
      this.processPage(page, null, 0, index, pages);
    });

    return pages;
  }

  /**
   * Recursively process a page and its children
   * @param page Page to process
   * @param parentId Parent page ID
   * @param level Nesting level
   * @param position Position among siblings
   * @param pages Accumulator array
   */
  private processPage(
    page: any,
    parentId: string | null,
    level: number,
    position: number,
    pages: NormalizedPage[],
  ): void {
    // Extract attributes (with @_ prefix from parser)
    // Try @_id first (attribute), then fallback to id (element), then auto-generate
    const pageId = page['@_id'] !== undefined ? page['@_id'] :
                   (page.id !== undefined ? page.id : `page_${pages.length}`);
    const pageTitle = page['@_title'] !== undefined ? page['@_title'] :
                      (page.title !== undefined ? page.title : 'Untitled Page');

    // Extract components
    const components = this.extractComponents(page.component);

    // Add current page
    pages.push({
      id: String(pageId),
      title: String(pageTitle),
      level,
      parent_id: parentId,
      position,
      components,
    });

    // Process child pages recursively
    if (page.page) {
      const childPages = Array.isArray(page.page) ? page.page : [page.page];
      childPages.forEach((childPage, index) => {
        this.processPage(childPage, String(pageId), level + 1, index, pages);
      });
    }
  }

  /**
   * Extract components from page
   * @param componentData Component data (single or array)
   * @returns Array of components
   */
  private extractComponents(
    componentData: any | any[] | undefined,
  ): OdeXmlComponent[] {
    if (!componentData) {
      return [];
    }

    const components = Array.isArray(componentData)
      ? componentData
      : [componentData];

    return components.map((comp, index) => ({
      id: String(comp['@_id'] !== undefined ? comp['@_id'] :
                (comp.id !== undefined ? comp.id : `component_${index}`)),
      type: String(comp['@_type'] !== undefined ? comp['@_type'] :
                  (comp.type !== undefined ? comp.type : 'unknown')),
      position: comp['@_position'] !== undefined ? comp['@_position'] :
               (comp.position !== undefined ? comp.position : index),
      properties: comp.properties || {},
      content: comp.content || '',
      data: comp.data || null,
    }));
  }

  /**
   * Extract metadata from ODE properties array
   * @param properties Array of odeProperty objects
   * @returns Normalized metadata
   */
  private extractMetadataFromOdeProperties(
    properties: Array<{ key: string; value: string }>,
  ): OdeXmlMeta {
    // Convert array to key-value map
    const propsMap = new Map<string, string>();
    properties.forEach((prop) => {
      if (prop.key && prop.value !== undefined) {
        propsMap.set(prop.key, prop.value);
      }
    });

    return {
      author: propsMap.get('pp_author') || '',
      title: propsMap.get('pp_title') || '',
      description: propsMap.get('pp_description') || '',
      language: propsMap.get('pp_lang') || 'en',
      license: propsMap.get('license') || '',
      keywords: propsMap.get('pp_keywords') || '',
      taxonomy: propsMap.get('pp_taxonomy') || '',
      aggregationLevel: '',
      structure: '',
      semanticDensity: '',
      difficulty: '',
      typicalLearningTime: '',
      context: '',
      endUser: '',
      interactivityType: '',
      interactivityLevel: '',
      cognitiveProcess: '',
      intendedEducationalUse: '',
      version: '3.0',
      exelearning_version: '',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };
  }

  /**
   * Normalize pages from ODE nav structures
   * @param navStructures Array of odeNavStructure objects
   * @returns Array of normalized pages
   */
  private normalizePagesFromOdeNavStructures(
    navStructures: RealOdeNavStructure | RealOdeNavStructure[],
  ): NormalizedPage[] {
    const pages: NormalizedPage[] = [];
    const structures = Array.isArray(navStructures)
      ? navStructures
      : [navStructures];

    // Build parent-child relationship map
    const childrenMap = new Map<string, RealOdeNavStructure[]>();
    structures.forEach((struct) => {
      const parentId = struct.odeParentPageId || '';
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(struct);
    });

    // Process root structures (no parent)
    const rootStructures = structures.filter(
      (s) => !s.odeParentPageId || s.odeParentPageId === '',
    );

    rootStructures.forEach((struct, index) => {
      this.processOdeNavStructure(struct, null, 0, index, pages, childrenMap);
    });

    return pages;
  }

  /**
   * Process a single ODE nav structure recursively
   * @param structure ODE nav structure
   * @param parentId Parent page ID
   * @param level Nesting level
   * @param position Position among siblings
   * @param pages Accumulator array
   * @param childrenMap Map of parent ID to children
   */
  private processOdeNavStructure(
    structure: RealOdeNavStructure,
    parentId: string | null,
    level: number,
    position: number,
    pages: NormalizedPage[],
    childrenMap: Map<string, RealOdeNavStructure[]>,
  ): void {
    const pageId = structure.odePageId;
    const title = structure.pageName || 'Untitled Page';

    // Extract components from odePagStructures
    const components = this.extractComponentsFromOdePagStructures(
      structure.odePagStructures?.odePagStructure,
    );

    // Add current page
    pages.push({
      id: pageId,
      title,
      level,
      parent_id: parentId,
      position,
      components,
    });

    // Process children
    const children = childrenMap.get(pageId) || [];
    children.forEach((child, index) => {
      this.processOdeNavStructure(
        child,
        pageId,
        level + 1,
        index,
        pages,
        childrenMap,
      );
    });
  }

  /**
   * Extract components from ODE pag structures
   * @param pagStructures odePagStructure or array of them
   * @returns Array of components
   */
  private extractComponentsFromOdePagStructures(
    pagStructures: RealOdePagStructure | RealOdePagStructure[] | undefined,
  ): OdeXmlComponent[] {
    if (!pagStructures) {
      return [];
    }

    const structures = Array.isArray(pagStructures)
      ? pagStructures
      : [pagStructures];

    const allComponents: OdeXmlComponent[] = [];

    structures.forEach((struct) => {
      if (struct.odeComponents) {
        const components = Array.isArray(struct.odeComponents.odeComponent)
          ? struct.odeComponents.odeComponent
          : [struct.odeComponents.odeComponent];

        components.forEach((comp, index) => {
          // Safely parse JSON properties
          let parsedData = null;
          if (comp.jsonProperties) {
            try {
              parsedData = JSON.parse(comp.jsonProperties);
            } catch (error) {
              this.logger.warn(`Failed to parse jsonProperties for component ${index}: ${error.message}`);
            }
          }

          allComponents.push({
            id: comp.odeIdeviceId || `component_${index}`,
            type: comp.odeIdeviceTypeName || 'unknown',
            position: comp.odeComponentsOrder !== undefined ? comp.odeComponentsOrder : index,
            properties: {},
            content: comp.htmlView || '',
            data: parsedData,
          });
        });
      }
    });

    return allComponents;
  }

  /**
   * Detect XML format and version
   * @param xmlContent XML content
   * @returns Format information
   */
  detectFormat(xmlContent: string): LegacyXmlFormat {
    try {
      // Check for ODE format
      if (xmlContent.includes('<exe_document>')) {
        return {
          version: '3.0',
          format: 'ode',
          requiresConversion: false,
        };
      }

      // Check for old EXE format
      if (xmlContent.includes('<content>') && xmlContent.includes('<node>')) {
        return {
          version: '2.x',
          format: 'exe_old',
          requiresConversion: true,
        };
      }

      return {
        version: 'unknown',
        format: 'unknown',
        requiresConversion: true,
      };
    } catch (error) {
      this.logger.error(`Failed to detect format: ${error.message}`);
      return {
        version: 'unknown',
        format: 'unknown',
        requiresConversion: true,
      };
    }
  }

  /**
   * Validate ODE XML structure
   * @param xmlContent XML content
   * @returns True if valid
   */
  async validateOdeXml(xmlContent: string): Promise<boolean> {
    try {
      const parsed = this.parser.parse(xmlContent);

      // Check for real ODE format (preferred)
      if (parsed.ode) {
        // Real ODE format is valid if it has odeNavStructures
        return true;
      }

      // Check for exe_document format (legacy)
      if (parsed.exe_document) {
        if (!parsed.exe_document.navigation) {
          this.logger.warn('Missing navigation element');
          return false;
        }

        if (!parsed.exe_document.navigation.page) {
          this.logger.warn('Missing page elements in navigation');
          return false;
        }

        return true;
      }

      this.logger.warn('Missing ode or exe_document root element');
      return false;
    } catch (error) {
      this.logger.error(`XML validation failed: ${error.message}`);
      return false;
    }
  }
}

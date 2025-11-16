import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ZipService } from '../../file-management/services/zip.service';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { ProjectOpenService } from '../../project/services/project-open.service';
import {
  ExportResult,
  Html5ExportOptions,
  ExportFormat,
} from '../dto/export.dto';
import { ParsedOdeStructure, NormalizedPage } from '../../xml/interfaces/ode-xml.interface';

@Injectable()
export class Html5ExportService {
  private readonly logger = new Logger(Html5ExportService.name);

  constructor(
    private readonly zipService: ZipService,
    private readonly fileHelper: FileHelperService,
    private readonly projectService: ProjectOpenService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Export session to HTML5 format
   * @param odeSessionId Session ID
   * @param options HTML5 export options
   * @returns Export result with file path
   */
  async exportToHtml5(
    odeSessionId: string,
    options: Html5ExportOptions = {},
  ): Promise<ExportResult> {
    try {
      this.logger.debug(`Exporting session ${odeSessionId} to HTML5`);

      // Get session
      const session = this.projectService.getSession(odeSessionId);
      if (!session) {
        throw new Error(`Session not found: ${odeSessionId}`);
      }

      // Create export directory
      const exportDir = this.fileHelper.getTempPath(`html5-export-${odeSessionId}`);
      await fs.ensureDir(exportDir);

      try {
        // Generate HTML5 files
        await this.generateHtml5Files(
          exportDir,
          session.structure,
          session.sessionPath,
          options,
        );

        // Create ZIP file
        const zipPath = `${exportDir}.zip`;
        await this.zipService.create(exportDir, zipPath, {
          compressionLevel: 9,
        });

        // Get file size
        const stats = await fs.stat(zipPath);

        this.logger.log(`Successfully exported HTML5 to ${zipPath}`);

        return {
          filePath: zipPath,
          fileName: `${session.structure.meta.title || 'export'}_html5.zip`,
          fileSize: stats.size,
          format: ExportFormat.HTML5,
        };
      } finally {
        // Cleanup export directory (keep ZIP)
        await fs.remove(exportDir);
      }
    } catch (error) {
      this.logger.error(`Failed to export HTML5: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate HTML5 files in export directory
   * @param exportDir Export directory path
   * @param structure Parsed ODE structure
   * @param sessionPath Session directory path
   * @param options HTML5 options
   */
  private async generateHtml5Files(
    exportDir: string,
    structure: ParsedOdeStructure,
    sessionPath: string,
    options: Html5ExportOptions,
  ): Promise<void> {
    // Generate index.html
    await this.generateIndexHtml(exportDir, structure, options);

    // Generate page HTML files
    for (const page of structure.pages) {
      await this.generatePageHtml(exportDir, page, structure, options);
    }

    // Copy resources
    await this.copyResources(sessionPath, exportDir);

    // Generate CSS
    await this.generateCss(exportDir, options);

    // Generate JavaScript
    await this.generateJavascript(exportDir, structure, options);
  }

  /**
   * Generate index.html
   * @param exportDir Export directory
   * @param structure ODE structure
   * @param options HTML5 options
   */
  private async generateIndexHtml(
    exportDir: string,
    structure: ParsedOdeStructure,
    options: Html5ExportOptions,
  ): Promise<void> {
    const { meta, pages } = structure;

    const html = `<!DOCTYPE html>
<html lang="${meta.language || 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(meta.title || 'eXe Learning Export')}</title>
    <meta name="author" content="${this.escapeHtml(meta.author || '')}">
    <meta name="description" content="${this.escapeHtml(meta.description || '')}">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        ${options.includeNavigation !== false ? this.generateNavigation(pages) : ''}
        <main id="content">
            <h1>${this.escapeHtml(meta.title || 'Welcome')}</h1>
            ${meta.description ? `<p class="description">${this.escapeHtml(meta.description)}</p>` : ''}
            <div class="page-list">
                ${this.generatePageList(pages)}
            </div>
        </main>
    </div>
    <script src="scripts.js"></script>
</body>
</html>`;

    await fs.writeFile(path.join(exportDir, 'index.html'), html, 'utf-8');
  }

  /**
   * Generate navigation HTML
   * @param pages Array of pages
   * @returns Navigation HTML
   */
  private generateNavigation(pages: NormalizedPage[]): string {
    const rootPages = pages.filter(p => p.parent_id === null);

    return `
    <nav class="sidebar">
        <ul class="nav-list">
            ${rootPages.map(page => this.generateNavItem(page, pages)).join('\n')}
        </ul>
    </nav>`;
  }

  /**
   * Generate navigation item
   * @param page Current page
   * @param allPages All pages
   * @returns Navigation item HTML
   */
  private generateNavItem(page: NormalizedPage, allPages: NormalizedPage[]): string {
    const children = allPages.filter(p => p.parent_id === page.id);

    return `
            <li>
                <a href="page_${page.id}.html">${this.escapeHtml(page.title)}</a>
                ${children.length > 0 ? `
                <ul>
                    ${children.map(child => this.generateNavItem(child, allPages)).join('\n')}
                </ul>` : ''}
            </li>`;
  }

  /**
   * Generate page list HTML
   * @param pages Array of pages
   * @returns Page list HTML
   */
  private generatePageList(pages: NormalizedPage[]): string {
    const rootPages = pages.filter(p => p.parent_id === null);

    return rootPages.map(page => `
        <div class="page-link">
            <a href="page_${page.id}.html">
                <h3>${this.escapeHtml(page.title)}</h3>
            </a>
        </div>
    `).join('\n');
  }

  /**
   * Generate page HTML file
   * @param exportDir Export directory
   * @param page Page to generate
   * @param structure Full ODE structure
   * @param options HTML5 options
   */
  private async generatePageHtml(
    exportDir: string,
    page: NormalizedPage,
    structure: ParsedOdeStructure,
    options: Html5ExportOptions,
  ): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="${structure.meta.language || 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(page.title)} - ${this.escapeHtml(structure.meta.title || '')}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        ${options.includeNavigation !== false ? this.generateNavigation(structure.pages) : ''}
        <main id="content">
            <h1>${this.escapeHtml(page.title)}</h1>
            <div class="page-content">
                ${this.generatePageContent(page)}
            </div>
            <div class="page-navigation">
                ${this.generatePageNavButtons(page, structure.pages)}
            </div>
        </main>
    </div>
    <script src="scripts.js"></script>
</body>
</html>`;

    await fs.writeFile(
      path.join(exportDir, `page_${page.id}.html`),
      html,
      'utf-8',
    );
  }

  /**
   * Generate page content from components
   * @param page Page with components
   * @returns Content HTML
   */
  private generatePageContent(page: NormalizedPage): string {
    if (!page.components || page.components.length === 0) {
      return '<p class="no-content">No content available</p>';
    }

    return page.components
      .sort((a, b) => a.position - b.position)
      .map(component => {
        const content = component.content || '';
        return `<div class="component component-${component.type.toLowerCase()}">${content}</div>`;
      })
      .join('\n');
  }

  /**
   * Generate page navigation buttons
   * @param currentPage Current page
   * @param allPages All pages
   * @returns Navigation buttons HTML
   */
  private generatePageNavButtons(
    currentPage: NormalizedPage,
    allPages: NormalizedPage[],
  ): string {
    const currentIndex = allPages.findIndex(p => p.id === currentPage.id);
    const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
    const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

    return `
        ${prevPage ? `<a href="page_${prevPage.id}.html" class="btn-prev">← ${this.escapeHtml(prevPage.title)}</a>` : ''}
        <a href="index.html" class="btn-home">Home</a>
        ${nextPage ? `<a href="page_${nextPage.id}.html" class="btn-next">${this.escapeHtml(nextPage.title)} →</a>` : ''}
    `;
  }

  /**
   * Copy resources from session to export directory
   * @param sessionPath Session directory path
   * @param exportDir Export directory path
   */
  private async copyResources(
    sessionPath: string,
    exportDir: string,
  ): Promise<void> {
    // Copy all files except content.xml
    const files = await fs.readdir(sessionPath);

    for (const file of files) {
      if (file === 'content.xml') continue;

      const sourcePath = path.join(sessionPath, file);
      const destPath = path.join(exportDir, file);

      const stats = await fs.stat(sourcePath);
      if (stats.isDirectory()) {
        await fs.copy(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Generate CSS file
   * @param exportDir Export directory
   * @param options HTML5 options
   */
  private async generateCss(
    exportDir: string,
    options: Html5ExportOptions,
  ): Promise<void> {
    const css = `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f5f5f5;
}

.container {
    display: flex;
    min-height: 100vh;
}

.sidebar {
    width: 250px;
    background: #2c3e50;
    color: white;
    padding: 20px;
    overflow-y: auto;
}

.sidebar .nav-list {
    list-style: none;
}

.sidebar .nav-list li {
    margin: 10px 0;
}

.sidebar .nav-list a {
    color: #ecf0f1;
    text-decoration: none;
    display: block;
    padding: 8px 12px;
    border-radius: 4px;
    transition: background 0.3s;
}

.sidebar .nav-list a:hover {
    background: #34495e;
}

.sidebar .nav-list ul {
    list-style: none;
    padding-left: 15px;
    margin-top: 5px;
}

main {
    flex: 1;
    padding: 40px;
    background: white;
    max-width: 900px;
    margin: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h1 {
    color: #2c3e50;
    margin-bottom: 20px;
    font-size: 2.5em;
}

h3 {
    color: #34495e;
    margin-bottom: 10px;
}

.description {
    color: #666;
    font-size: 1.1em;
    margin-bottom: 30px;
}

.page-list {
    display: grid;
    gap: 20px;
    margin-top: 30px;
}

.page-link {
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    transition: transform 0.2s, box-shadow 0.2s;
}

.page-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.page-link a {
    text-decoration: none;
    color: #2c3e50;
}

.page-content {
    margin: 30px 0;
    line-height: 1.8;
}

.component {
    margin: 20px 0;
    padding: 15px;
    background: #f8f9fa;
    border-left: 4px solid #3498db;
    border-radius: 4px;
}

.page-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #eee;
}

.page-navigation a {
    padding: 10px 20px;
    background: #3498db;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    transition: background 0.3s;
}

.page-navigation a:hover {
    background: #2980b9;
}

.btn-home {
    background: #95a5a6 !important;
}

.btn-home:hover {
    background: #7f8c8d !important;
}

@media (max-width: 768px) {
    .container {
        flex-direction: column;
    }

    .sidebar {
        width: 100%;
    }

    main {
        margin: 0;
        border-radius: 0;
    }
}
`;

    await fs.writeFile(path.join(exportDir, 'styles.css'), css, 'utf-8');
  }

  /**
   * Generate JavaScript file
   * @param exportDir Export directory
   * @param structure ODE structure
   * @param options HTML5 options
   */
  private async generateJavascript(
    exportDir: string,
    structure: ParsedOdeStructure,
    options: Html5ExportOptions,
  ): Promise<void> {
    const js = `
// eXe Learning HTML5 Export
(function() {
    'use strict';

    // Highlight current page in navigation
    function highlightCurrentPage() {
        const currentPage = window.location.pathname.split('/').pop();
        const links = document.querySelectorAll('.sidebar a');

        links.forEach(link => {
            if (link.getAttribute('href') === currentPage) {
                link.style.background = '#34495e';
                link.style.fontWeight = 'bold';
            }
        });
    }

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        highlightCurrentPage();
    });
})();
`;

    await fs.writeFile(path.join(exportDir, 'scripts.js'), js, 'utf-8');
  }

  /**
   * Escape HTML special characters
   * @param text Text to escape
   * @returns Escaped text
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

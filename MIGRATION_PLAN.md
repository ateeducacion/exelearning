# Export/Import Migration Implementation Plan

## Overview
This document provides a complete implementation plan for migrating the export and import functionality from Symfony to NestJS with comprehensive Jest tests.

## Progress Tracking

### ✅ Completed
- [x] Installed dependencies (adm-zip, archiver, fast-xml-parser, fs-extra)
- [x] Created File Management Module structure
- [x] Implemented ZipService (285 lines)
- [x] Implemented FileHelperService (248 lines)
- [x] Created FileManagementModule

### 🚧 In Progress
- [ ] Jest tests for File Management services

### ⏳ Pending
- [ ] XML Module implementation
- [ ] Project Module implementation
- [ ] Export Module implementation
- [ ] Integration tests
- [ ] End-to-end tests

---

## Phase 1: File Management Module (COMPLETED)

### Files Created

#### 1. ZipService (`src/modules/file-management/services/zip.service.ts`)
**Status:** ✅ Complete
**Lines:** 285
**Key Methods:**
- `extract(zipPath, destPath, options)` - Extract ZIP archives
- `create(sourceDir, zipPath, options)` - Create compressed ZIP files
- `listContents(zipPath)` - List all files in ZIP
- `hasFile(zipPath, filePath)` - Check if file exists in ZIP
- `getFile(zipPath, filePath)` - Extract single file without full extraction
- `isValidZip(zipPath)` - Validate ZIP integrity

#### 2. FileHelperService (`src/modules/file-management/services/file-helper.service.ts`)
**Status:** ✅ Complete
**Lines:** 248
**Key Methods:**
- `getOdeSessionDistDir(sessionId)` - Get session distribution directory
- `getOdeSessionTempDir(sessionId)` - Get session temp directory
- `getPermanentStorageDir()` - Get permanent ELP storage
- `createSessionDirectories(sessionId)` - Create all session dirs
- `cleanupSessionDirectories(sessionId, keepDist)` - Cleanup session
- `copyDirectory(source, dest, options)` - Recursive directory copy
- `getDirectorySize(dirPath)` - Calculate directory size
- `getTempPath(prefix)` - Generate unique temp path
- `ensureWritableDirectory(dirPath)` - Ensure write permissions
- `isPathSafe(basePath, targetPath)` - Security: prevent path traversal
- `getMimeType(filePath)` - Get MIME type from extension

#### 3. FileManagementModule (`src/modules/file-management/file-management.module.ts`)
**Status:** ✅ Complete
**Lines:** 12
Exports: ZipService, FileHelperService

---

## Phase 1: Jest Tests for File Management

### Test Files to Create

#### 1. `test/unit/file-management/zip.service.spec.ts`
**Status:** ⏳ Pending
**Estimated Lines:** 300

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ZipService } from '../../../src/modules/file-management/services/zip.service';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('ZipService', () => {
  let service: ZipService;
  let testDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZipService],
    }).compile();

    service = module.get<ZipService>(ZipService);
    testDir = path.join(__dirname, '../../fixtures/temp');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('extract', () => {
    it('should extract ZIP file successfully', async () => {
      // Test implementation
    });

    it('should handle non-existent ZIP file', async () => {
      // Test implementation
    });

    it('should respect overwrite option', async () => {
      // Test implementation
    });
  });

  describe('create', () => {
    it('should create ZIP from directory', async () => {
      // Test implementation
    });

    it('should apply compression level', async () => {
      // Test implementation
    });

    it('should exclude patterns', async () => {
      // Test implementation
    });
  });

  describe('listContents', () => {
    it('should list all files in ZIP', async () => {
      // Test implementation
    });

    it('should exclude directories', async () => {
      // Test implementation
    });
  });

  describe('hasFile', () => {
    it('should return true for existing file', async () => {
      // Test implementation
    });

    it('should return false for non-existing file', async () => {
      // Test implementation
    });
  });

  describe('getFile', () => {
    it('should extract single file', async () => {
      // Test implementation
    });

    it('should return null for non-existing file', async () => {
      // Test implementation
    });
  });

  describe('isValidZip', () => {
    it('should validate correct ZIP', async () => {
      // Test implementation
    });

    it('should reject invalid ZIP', async () => {
      // Test implementation
    });
  });
});
```

**Test Coverage Targets:**
- Extract operations: 6 tests
- Create operations: 5 tests
- List operations: 3 tests
- File operations: 4 tests
- Validation: 3 tests
- **Total: 21 tests**

#### 2. `test/unit/file-management/file-helper.service.spec.ts`
**Status:** ⏳ Pending
**Estimated Lines:** 350

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FileHelperService } from '../../../src/modules/file-management/services/file-helper.service';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('FileHelperService', () => {
  let service: FileHelperService;
  let configService: ConfigService;
  let testDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileHelperService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'FILES_DIR') return path.join(__dirname, '../../fixtures/files');
              if (key === 'PUBLIC_DIR') return path.join(__dirname, '../../fixtures/public');
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FileHelperService>(FileHelperService);
    configService = module.get<ConfigService>(ConfigService);
    testDir = path.join(__dirname, '../../fixtures/temp');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('getOdeSessionDistDir', () => {
    it('should return correct session dist path', () => {
      // Test implementation
    });
  });

  describe('createSessionDirectories', () => {
    it('should create all required directories', async () => {
      // Test implementation
    });
  });

  describe('cleanupSessionDirectories', () => {
    it('should remove temp directory', async () => {
      // Test implementation
    });

    it('should keep dist when requested', async () => {
      // Test implementation
    });
  });

  describe('copyDirectory', () => {
    it('should copy directory recursively', async () => {
      // Test implementation
    });

    it('should respect filter option', async () => {
      // Test implementation
    });
  });

  describe('getDirectorySize', () => {
    it('should calculate size recursively', async () => {
      // Test implementation
    });
  });

  describe('ensureWritableDirectory', () => {
    it('should return true for writable directory', async () => {
      // Test implementation
    });

    it('should return false for non-writable directory', async () => {
      // Test implementation
    });
  });

  describe('isPathSafe', () => {
    it('should allow safe paths', () => {
      // Test implementation
    });

    it('should reject path traversal attempts', () => {
      // Test implementation
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types', () => {
      expect(service.getMimeType('test.html')).toBe('text/html');
      expect(service.getMimeType('test.json')).toBe('application/json');
      expect(service.getMimeType('test.zip')).toBe('application/zip');
    });
  });
});
```

**Test Coverage Targets:**
- Path operations: 8 tests
- Directory management: 6 tests
- Copy operations: 4 tests
- Size calculations: 3 tests
- Security checks: 4 tests
- Utility functions: 5 tests
- **Total: 30 tests**

---

## Phase 2: XML Module Implementation

### Files to Create

#### 1. `src/modules/xml/services/xml-parser.service.ts`
**Status:** ⏳ Pending
**Estimated Lines:** 350

**Key Responsibilities:**
- Parse ODE XML format (content.xml)
- Extract navigation structure
- Extract page structure
- Extract iDevice components
- Extract project properties
- Handle malformed XML gracefully

**Key Methods:**
```typescript
parseOdeXml(xmlContent: string): Promise<OdeXmlStructure>
parseNavigationStructure(xmlNode: any): NavigationStructure[]
parsePageStructure(xmlNode: any): PageStructure[]
parseComponents(xmlNode: any): ComponentStructure[]
parseProperties(xmlNode: any): Record<string, PropertyValue>
validateStructure(structure: OdeXmlStructure): boolean
```

**Dependencies:**
- fast-xml-parser
- Logger

#### 2. `src/modules/xml/services/legacy-xml-parser.service.ts`
**Status:** ⏳ Pending
**Estimated Lines:** 250

**Key Responsibilities:**
- Parse legacy EXE XML format
- Convert to ODE XML structure
- Handle old property names
- Map old iDevice types to new

#### 3. `src/modules/xml/services/xml-builder.service.ts`
**Status:** ⏳ Pending
**Estimated Lines:** 300

**Key Responsibilities:**
- Generate content.xml for exports
- Build navigation XML
- Build page structure XML
- Build iDevice XML
- Format and prettify output

#### 4. `src/modules/xml/xml.module.ts`
**Status:** ⏳ Pending
**Estimated Lines:** 15

### Interfaces to Create

#### `src/modules/xml/interfaces/ode-xml-structure.interface.ts`
```typescript
export interface OdeXmlStructure {
  odeId: string;
  odeVersionId: string;
  odeSessionId: string;
  odeVersionName: string;
  theme: string;
  themeDir: string;
  odeNavStructureSyncs: NavigationStructure[];
  odeProperties: Record<string, PropertyValue>;
  srcRoutes: string[];
  odeComponentsMapping: Record<string, string>;
}

export interface NavigationStructure {
  odePageId: string;
  odeParentPageId: string | null;
  odeSessionId: string;
  pageName: string;
  isIndex: boolean;
  order: number;
  odePagStructureSyncs: PageStructure[];
}

export interface PageStructure {
  odeBlockId: string;
  blockName: string;
  order: number;
  odeComponentsSyncs: ComponentStructure[];
}

export interface ComponentStructure {
  odeIdeviceId: string;
  odeIdeviceTypeName: string;
  order: number;
  htmlView: string;
  jsonProperties: string;
}

export interface PropertyValue {
  value: any;
  type: string;
}
```

### Test Files

#### `test/unit/xml/xml-parser.service.spec.ts`
**Estimated Lines:** 250
**Test Cases:** 15 tests

#### `test/unit/xml/legacy-xml-parser.service.spec.ts`
**Estimated Lines:** 200
**Test Cases:** 12 tests

#### `test/unit/xml/xml-builder.service.spec.ts`
**Estimated Lines:** 200
**Test Cases:** 12 tests

### Test Fixtures

#### `test/fixtures/xml/sample-content.xml`
A valid ODE XML file with multiple pages, blocks, and iDevices

#### `test/fixtures/xml/sample-legacy-content.xml`
A valid legacy EXE XML file

#### `test/fixtures/xml/invalid-content.xml`
Malformed XML for error handling tests

---

## Phase 3: Project Module Implementation

This is extensive - I'll provide a summary. Full implementation plan available on request.

### Services Needed
1. **ProjectService** - Main orchestration
2. **ProjectOpenService** - Open ELP files
3. **ProjectImportService** - Import pages
4. **ProjectSaveService** - Save projects

**Total Estimated Lines:** ~800 lines code + ~600 lines tests

---

## Phase 4: Export Module Implementation

### Services Needed
1. **ExportService** - Main orchestration
2. **Html5ExportService** - HTML5 export
3. **Scorm12ExportService** - SCORM 1.2
4. **Scorm2004ExportService** - SCORM 2004
5. **Epub3ExportService** - EPUB3

**Total Estimated Lines:** ~1000 lines code + ~700 lines tests

---

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- zip.service.spec.ts

# Run tests for specific module
npm test -- file-management
```

### Coverage Targets

- **Statements:** >80%
- **Branches:** >75%
- **Functions:** >80%
- **Lines:** >80%

---

## Integration Checklist

### After File Management Module
- [ ] Import FileManagementModule into AppModule
- [ ] Test ZipService in isolation
- [ ] Test FileHelperService with real directories
- [ ] Verify no path traversal vulnerabilities

### After XML Module
- [ ] Test parsing real ELP files
- [ ] Test legacy XML compatibility
- [ ] Verify XML generation matches Symfony output

### After Project Module
- [ ] Test full open workflow
- [ ] Test import into existing project
- [ ] Test ID conflict resolution
- [ ] Verify database entity creation

### After Export Module
- [ ] Test HTML5 export end-to-end
- [ ] Verify preview mode
- [ ] Test all export formats
- [ ] Verify ZIP creation

---

## Next Steps

1. **Create Jest tests for File Management** (current task)
2. **Implement XML Module with tests**
3. **Implement Project Module with tests**
4. **Implement Export Module with tests**
5. **Integration testing**
6. **Update API endpoints to use new services**

---

## Estimated Timeline

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | File Management Tests | 2-3 hours |
| 2 | XML Module + Tests | 4-6 hours |
| 3 | Project Module + Tests | 6-8 hours |
| 4 | Export Module + Tests | 8-10 hours |
| 5 | Integration | 2-4 hours |
| 6 | Documentation | 2-3 hours |
| **Total** | | **24-34 hours** |

---

## Key Decisions Made

1. **ZIP Library:** Using `adm-zip` for extraction, `archiver` for creation
2. **XML Library:** Using `fast-xml-parser` for parsing
3. **File Operations:** Using `fs-extra` for enhanced file system ops
4. **Testing Framework:** Jest (already in NestJS)
5. **Module Structure:** Separate modules for File, XML, Project, Export
6. **Test Organization:** Unit tests in test/unit, integration in test/integration

---

## Resources

- [NestJS Testing Docs](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Symfony Service Reference](../src/Service/net/exelearning/Service/Api/)
- [Migration Plan](./MIGRATION_PLAN.md) - This file

---

## Contact

For questions about this migration, refer to the detailed plan document created by the Task agent.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

eXeLearning is an open-source educational content authoring tool (AGPL-3.0) that allows educators to create and export interactive learning materials in multiple formats (SCORM 1.2/2004, HTML5, EPUB3, IMS Content Package).

**Current State**: Active migration from Symfony (v3.0 production) to NestJS (v4.0 development). Project restructured with Symfony legacy code in `symfony_legacy/` and NestJS as the main application in project root.

## Architecture

### Single Backend System (NestJS)

The Electron main process (`main.js`) now runs only the NestJS backend (port 3001).
Symfony legacy code has been moved to `symfony_legacy/` for reference during migration.

Frontend remains shared vanilla JavaScript in `/public/app/` (9.6 MB).

### NestJS Module Structure

```
AppModule
├── AuthModule - JWT authentication, bcrypt passwords
├── ProjectModule - ELP file opening, session management
├── FileManagementModule - ZIP operations, directory management (CRITICAL)
├── XmlModule - ODE XML parsing/building (CRITICAL)
├── ExportModule - HTML5/SCORM/EPUB3 export services
├── WorkareaModule - Nunjucks template rendering
├── PagesModule - Page rendering
└── HealthModule - Health check endpoints
```

**Key Services:**
- `ProjectOpenService` (317 lines) - Opens ELP files, manages sessions
- `ZipService` (263 lines) - JSZip extraction, Archiver creation
- `FileHelperService` (309 lines) - Session directories, file operations
- `XmlParserService` (547 lines) - Parses ODE XML from ELP files
- `XmlBuilderService` (285 lines) - Generates content.xml
- `Html5ExportService` (550 lines) - HTML5 export implementation

### Session-Based Architecture

Every opened project receives a UUID session ID. The file system structure mirrors this:

```
FILES_DIR/
├── tmp/{sessionId}/      # ELP extraction directory
├── dist/{sessionId}/     # Export output
└── perm/odes/{odeId}/    # Permanent storage
```

Sessions are stored in-memory (`Map<sessionId, ProjectSession>`) and include:
- Parsed XML structure
- File paths (sessionPath, contentPath)
- Created/modified timestamps

### ELP File Format

ELP files are ZIP archives containing:
- `content.xml` (ODE format) or `contentv3.xml` (legacy)
- Static assets (images, media, themes)
- Hierarchical structure: Navigation → Pages → Blocks → iDevices

## Development Commands

### NestJS Development (root)

```bash
# Development server with hot reload
npm run start:dev

# Create database with test user (user@exelearning.net / 1234)
npm run seed

# Run Electron pointing to NestJS backend
npm run electron:dev

# Testing
npm test                          # All tests
npm test -- --watch               # Watch mode
npm test -- zip.service.spec.ts   # Specific test file
npm test -- file-management       # Module tests
npm run test:coverage             # Coverage report

# Build
npm run build                     # Compile TypeScript
npm run electron:pack             # Build Electron installer
```

### Symfony Legacy Development (symfony_legacy/)

```bash
# Docker containers
make legacy-up                # Start (foreground)
make legacy-upd               # Start (background, wait for health)
make legacy-down              # Stop

# Symfony
make legacy-console           # Symfony console
make legacy-cache-clear       # Clear cache

# Testing
cd symfony_legacy && composer phpunit       # All tests
cd symfony_legacy && composer phpunit-unit  # Unit tests
cd symfony_legacy && composer phpunit-e2e   # E2E with Panther
```

## Testing

### Framework Configuration

- **NestJS**: Jest with ts-jest preset
- **Symfony**: PHPUnit + Panther (E2E)
- **Coverage Target**: >80% (per MIGRATION_PLAN.md)
- **Test Timeout**: 30 seconds
- **Max Workers**: 1 (sequential for SQLite)

### Test Structure

```
test/
├── unit/              # Isolated service tests
├── integration/       # Multi-service integration tests
├── fixtures/xml/      # Sample content.xml files
└── temp/             # Test artifacts (cleaned automatically)
```

### Running Specific Tests

```bash
# By file
npm test -- xml-parser.service.spec.ts

# By pattern
npm test -- --testPathPattern=file-management

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

## Database

**SQLite Only** - Uses sql.js (WebAssembly) for browser compatibility.

```typescript
// TypeORM config (app.module.ts)
{
  type: 'sqljs',
  database: fs.readFileSync('data/exelearning.db'),
  autoSave: true,
  autoSaveInterval: 1000,
  synchronize: false  // NEVER true in production
}
```

**Current Entities**: Only `User` entity implemented. Pending migration of 14+ Symfony entities (OdeFiles, OdePropertiesSync, CurrentOdeUsers, etc.).

**Seeding**: `npm run seed` creates test database with user `user@exelearning.net`.

## Critical Migration Context

### The Monolith Being Decomposed

`symfony_legacy/src/Service/net/exelearning/Service/Api/OdeService.php` (3,280 lines) is being split into:
- **FileManagementModule** - File operations, ZIP handling
- **XmlModule** - XML parsing/building
- **ProjectModule** - Project CRUD, session management
- **ExportModule** - Export strategies per format

See migration documentation for detailed roadmap.

### Migration Status

✅ **Completed**:
- File Management Module (ZipService, FileHelperService)
- XML Module (XmlParserService, XmlBuilderService)
- Auth Module (JWT, bcrypt)
- Project Module foundations
- HTML5 export basics

🚧 **In Progress**:
- Export strategies (SCORM, EPUB3)
- Database entity migration
- Jest integration tests

⏳ **Pending**:
- WebSocket/Socket.io (real-time collaboration)
- Full project CRUD
- Import functionality
- Frontend integration

## Important Patterns

### File Upload Flow

1. Upload ELP → temp storage
2. Generate session ID (`uuidv4()`)
3. Create session directories via `FileHelperService.createSessionDirectories()`
4. Extract ZIP via `ZipService.extract()`
5. Parse XML via `XmlParserService.parseOdeXml()`
6. Store session in `ProjectOpenService.sessions` Map
7. Return session ID to frontend

### Export Flow

1. Get session structure
2. Create export directory (`FileHelperService.getTempPath()`)
3. Generate format-specific files (HTML, manifest, etc.)
4. Copy theme files and assets
5. Create ZIP archive (`ZipService.create()`)
6. Return download path

### Environment Configuration

**NestJS loads environment in this order**:
1. `.env` (local environment file)
2. `.env.dist` (distribution template)
3. System environment variables (highest priority)

**Critical variables**:
- `FILES_DIR` - Session/temp file storage (default: `/tmp/exelearning-files`)
- `DB_PATH` - SQLite database location
- `NEST_PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode

**Note**: System environment variables override .env files. Check `echo $FILES_DIR` if encountering path issues.

## Common Development Tasks

### Generate New Module

```bash
npx @nestjs/cli generate module modules/new-feature
npx @nestjs/cli generate service modules/new-feature
npx @nestjs/cli generate controller modules/new-feature
```

### Add New Entity

1. Create in `src/entities/new-entity.entity.ts`
2. Import in module: `TypeOrmModule.forFeature([NewEntity])`
3. Create repository/service for CRUD operations
4. Add unit tests in `test/unit/`

### Debug Electron

```bash
EXELEARNING_DEBUG_MODE=1 npm run electron:dev
# Opens DevTools automatically
# Check main.js for IPC events
```

### Run Integration Test

```bash
# Create test in test/integration/
# Use real ELP fixtures from test/fixtures/
npm test -- --testPathPattern=integration
```

## Key File Locations

### Documentation
- `MIGRATION_NESTJS_README.md` - Migration instructions
- `MIGRATION_PROGRESS.md` - Migration progress tracking
- `PLAN_MIGRACION_NESTJS.md` - Complete migration plan
- `ARCHITECTURE_PROMPT.md` - Full architecture specification
- `CLAUDE.md` - This file

### Critical Services
- `src/modules/file-management/services/` - File operations (ZIP, directories)
- `src/modules/xml/services/` - ODE XML parsing/building
- `src/modules/project/services/project-open.service.ts` - Session management
- `src/modules/export/services/html5-export.service.ts` - Export implementation

### Electron
- `main.js` - Main process (Electron entry point)
- `preload.js` - Preload script
- `update-manager.js` - Auto-update logic

### Frontend
- `public/app/` - Vanilla JavaScript (9.6 MB)
- `public/libs/` - jQuery, TinyMCE, Bootstrap

### Configuration
- `.env` - Environment configuration
- `tsconfig.json` - TypeScript config
- `jest.config.js` - Jest config
- `Makefile` - Build commands (includes legacy- prefixed Symfony commands)

### Symfony Legacy
- `symfony_legacy/` - Legacy Symfony application
- `symfony_legacy/src/` - PHP source code
- `symfony_legacy/templates/` - Twig templates

## Known Issues & Workarounds

### SQLite Concurrency
- Use `maxWorkers: 1` in Jest to prevent database locks
- Sessions are in-memory only (lost on server restart)

### File Paths
- Always use `FileHelperService.isPathSafe()` to prevent path traversal
- Use `path.join()` for cross-platform compatibility
- Electron uses different paths (`appData/exelearning/`) vs development

### ZIP Extraction
- Use JSZip for extraction (not adm-zip - creates 0-byte files in Jest)
- Use Archiver for ZIP creation
- Always check `zipEntry.dir` before reading file content

### Environment Variables
- System env vars override .env files
- Electron now uses NestJS by default
- Check for stale `FILES_DIR` in shell profile if encountering `/mnt` errors

## Architecture Decisions

### Why SQLite Only?
- Simplifies offline desktop use
- sql.js provides browser compatibility
- No migration burden for users
- Auto-save with atomic writes

### Why Modular Migration?
- Allows gradual transition without breaking production
- Enables parallel development (Symfony maintenance + NestJS features)
- Reduces risk compared to big-bang rewrite
- Maintains business continuity

### Why Session-Based (Not Database)?
- Faster file operations without DB overhead
- Natural cleanup on server restart
- Simpler concurrency model
- Matches desktop single-user pattern

## External Resources

- GitHub: https://github.com/exelearning/exelearning
- Documentation: https://exelearning.net/
- Branch: `exe4` (NestJS migration)
- Main branch: Symfony production code

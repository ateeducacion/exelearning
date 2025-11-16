# Architecture Definition Prompt for eXeLearning 4.0 Migration

## Context

You are an expert software architect tasked with defining the complete architecture for **eXeLearning 4.0**, a migration from the current Symfony (PHP) + JavaScript vanilla stack to a modern **NestJS (TypeScript) + Vite (TypeScript)** stack.

eXeLearning is an **authoring tool for educational content** that allows users to create, edit, and export interactive learning materials in multiple formats (SCORM 1.2, SCORM 2004, HTML5, EPUB3, IMS Content Package).

## Current State (eXeLearning 3.0)

### Architecture
- **Backend**: Symfony 7.3 (PHP 8.4)
- **Frontend**: JavaScript vanilla ES6 (no framework)
- **Deployment**: Electron desktop app with embedded PHP runtime
- **Database**: SQLite (primary), MySQL, PostgreSQL (optional)
- **Real-time**: Mercure (WebSockets)
- **Template Engine**: Twig
- **Build**: Makefile for project management
- **Package**: electron-builder for installers

### Key Components
1. **OdeService.php** (123,777 lines) - Core business logic for educational content management
2. **69 API controllers** - REST endpoints for `/api/*`
3. **WorkareaController** - Renders single Twig template (`workarea.html.twig`)
4. **Export services** - SCORM, HTML5, EPUB3, IMS exporters
5. **Collaboration** - Real-time multi-user editing via Mercure

### File Structure
```
exelearning/
├── main.js                    # Electron main process
├── src/                       # Symfony backend
│   ├── Controller/
│   ├── Service/
│   │   └── Api/OdeService.php # 123K lines monolith
│   └── Entity/
├── templates/                 # Twig templates
│   └── workarea/workarea.html.twig
├── public/
│   ├── app/                   # JavaScript vanilla (9.6 MB)
│   ├── libs/                  # jQuery, Bootstrap, TinyMCE
│   └── style/
├── Makefile
└── package.json               # Electron
```

## Target Architecture (eXeLearning 4.0)

### Technology Stack

**Backend:**
- NestJS 10+ (TypeScript)
- TypeORM 0.3+ (ORM)
- SQLite (database - **ONLY**)
- Socket.io (WebSockets)
- Nunjucks (template engine)
- Sharp (image processing)
- JSZip/Archiver (compression)

**Frontend:**
- Vite 5+ (build tool + dev server)
- TypeScript
- React 18+ or Vue 3+ (choose best fit)
- TailwindCSS or similar (styling)
- TinyMCE 6+ (WYSIWYG editor)
- Socket.io-client (WebSockets)

**CLI:**
- Commander.js (CLI framework)
- Shared core with backend

**MCP (Model Context Protocol):**
- MCP server for AI resource generation
- Integration with backend services

**Desktop:**
- Electron 39+ (desktop wrapper)
- Electron Builder (packaging)

**Development:**
- Makefile (project management)
- Jest (testing)
- ESLint + Prettier (code quality)
- GitHub Actions (CI/CD)

### Deployment Modes

**Single Interface with Configuration Toggle:**

The application has **ONE INTERFACE** that adapts based on configuration:

```typescript
// config/app.config.ts
export interface AppConfig {
  mode: 'online' | 'offline';
  deployment: 'multi-user' | 'single-user';
}
```

**Mode Behavior:**

1. **Online Multi-user** (`mode: 'online'`, `deployment: 'multi-user'`)
   - Show login screen
   - Enable collaboration features (real-time editing, user presence)
   - Enable user management
   - Full authentication/authorization

2. **Offline Single-user** (`mode: 'offline'`, `deployment: 'single-user'`)
   - Skip login (auto-login as anonymous)
   - Hide collaboration UI
   - Disable user management
   - Embeddable in LMS (Moodle, WordPress via iframe/embed)

**Key Principle:** Same codebase, same UI components, just different configuration and feature visibility.

### Use Cases

1. **Desktop Application (Electron)**
   - User downloads installer
   - Runs locally with embedded Node.js + SQLite
   - Can be configured as online or offline

2. **Web Application (Browser)**
   - Hosted on server
   - Users access via URL
   - Online multi-user mode

3. **Embedded in LMS**
   - WordPress plugin
   - Moodle activity module
   - Iframe embed
   - Offline single-user mode

4. **CLI Tool**
   - Export projects from command line
   - Preview .elp files
   - Batch operations

5. **AI Integration (MCP)**
   - AI generates educational resources
   - MCP server exposes project API
   - AI can create/modify content

### PR Preview Deployment

**Requirement:** Every GitHub PR should be automatically deployable to a unique URL for testing.

**Architecture:**

```
GitHub PR #123 → GitHub Actions → Build → Deploy to:
https://preview-pr-123.exelearning.dev

User clicks link → Opens eXeLearning in browser with PR changes
```

**Implementation Strategy:**
- Use GitHub Actions to build on PR
- Deploy to cloud hosting (Vercel, Netlify, or custom)
- Each PR gets unique subdomain or path
- Auto-cleanup after PR merge/close
- Use environment variables to configure preview mode

## Your Task

Define a **complete, detailed, production-ready architecture** for eXeLearning 4.0 with the following requirements:

### 1. Project Structure

Define the **exact folder structure** for:

```
exelearning/
├── backend/              # NestJS backend
├── frontend/             # Vite frontend
├── cli/                  # CLI tool
├── mcp/                  # MCP server
├── main.js               # Electron main process
├── preload.js            # Electron preload script
├── update-manager.js     # Electron auto-updater
├── shared/               # Shared types/utils
├── Makefile              # Project management
└── ...
```

**Requirements:**
- Monorepo or multi-repo? (recommend and justify)
- Shared code strategy (types, utilities, validation)
- Build output directories
- Configuration management
- Environment files

### 2. Backend Architecture (NestJS)

Define the **complete backend architecture**:

#### Module Structure
- Break down OdeService.php (123K lines) into **logical modules**
- Define all NestJS modules with clear responsibilities
- Module dependency graph
- Shared modules

#### Example modules (expand and complete):
```typescript
AppModule
├── ConfigModule (global)
├── DatabaseModule (TypeORM + SQLite)
├── AuthModule
├── UsersModule
├── ProjectsModule
│   ├── PagesModule
│   └── BlocksModule
├── OdeModule
│   ├── OdeComponentsService
│   ├── OdeNavigationService
│   ├── OdeStructureService
│   └── ...
├── ExportModule
│   ├── Html5ExportStrategy
│   ├── Scorm12ExportStrategy
│   ├── Scorm2004ExportStrategy
│   └── Epub3ExportStrategy
├── FileManagerModule
├── ThemesModule
├── IDevicesModule
├── TranslationModule
├── CollaborationModule (WebSocket)
├── StorageModule (Google Drive, Dropbox)
└── HealthModule
```

#### Database Schema
- Define all entities (User, Project, Page, Block, etc.)
- Relationships between entities
- Indexes for performance
- Migration strategy

#### API Design
- REST endpoint structure (`/api/*`)
- DTOs (Data Transfer Objects)
- Validation rules
- Error handling strategy
- API versioning (if needed)

#### Real-time (WebSockets)
- Socket.io gateway design
- Events to emit/listen
- Room management for collaboration
- Connection authentication

#### Configuration
- Environment variables (`.env`)
- Configuration per deployment mode
- Feature flags

### 3. Frontend Architecture (Vite + React/Vue)

Define the **complete frontend architecture**:

#### Technology Choice
- **React** or **Vue**? (choose one and justify)
- State management (Redux, Zustand, Pinia, Vuex?)
- Routing library
- UI component library (or custom with Tailwind?)

#### Folder Structure
```typescript
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── WorkareaPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── ...
│   ├── components/
│   │   ├── editor/
│   │   ├── navigation/
│   │   ├── modals/
│   │   └── ...
│   ├── hooks/
│   ├── store/
│   ├── services/
│   │   ├── api.service.ts
│   │   ├── websocket.service.ts
│   │   └── ...
│   ├── types/
│   ├── utils/
│   └── styles/
├── vite.config.ts
└── package.json
```

#### Component Architecture
- Atomic design? Feature-based? (choose and justify)
- Shared components strategy
- Code splitting strategy

#### State Management
- Global state (user, project, settings)
- Local state (component state)
- Server state (API cache with React Query or similar?)

#### API Communication
- HTTP client (axios, fetch?)
- API client architecture
- Error handling
- Loading states
- Optimistic updates

#### Real-time Features
- WebSocket connection management
- Presence tracking
- Conflict resolution for collaborative editing

#### Build Configuration
- Vite config for development
- Vite config for production
- Environment variables
- Asset optimization

### 4. CLI Architecture

Define the **CLI tool** for:

```bash
exe-cli export <project-id> --format scorm12 --output ./dist
exe-cli preview <file.elp>
exe-cli validate <project-id>
exe-cli generate --template basic --name "My Course"
```

#### Requirements:
- Share core logic with backend (how?)
- Standalone executable
- Progress indicators
- Error handling
- Help/documentation

### 5. MCP Server Architecture

Define the **MCP (Model Context Protocol) server** for AI integration:

#### Capabilities:
- AI can create new projects
- AI can add/modify pages and blocks
- AI can generate iDevices content
- AI can export projects

#### API Design:
- MCP endpoints
- Authentication/authorization
- Rate limiting
- Tool definitions for AI

#### Example MCP tools:
```typescript
{
  "tools": [
    {
      "name": "create_project",
      "description": "Create a new educational project",
      "inputSchema": { ... }
    },
    {
      "name": "add_page",
      "description": "Add a page to a project",
      "inputSchema": { ... }
    },
    // ... more tools
  ]
}
```

### 6. Electron Integration

Define how **Electron wraps the web application**:

#### main.js Architecture
- Start NestJS server (child process)
- Wait for server ready
- Open browser window
- IPC communication
- Window management
- Auto-updates

#### Packaging
- Include Node.js runtime
- Include SQLite binaries
- Bundle frontend assets
- Platform-specific builds (Windows, macOS, Linux)

#### Configuration
- Detect online/offline mode
- Database location (user data folder)
- Port management (random available port)

### 7. Makefile Commands

Define all **Makefile targets** for easy project management:

#### Required commands:
```makefile
make install       # Install all dependencies
make dev           # Start development (backend + frontend)
make build         # Build for production
make test          # Run all tests
make lint          # Lint code
make format        # Format code

# Deployment modes
make up-online     # Start online multi-user mode
make up-offline    # Start offline single-user mode

# Packaging
make package       # Build installers for all platforms
make package-win   # Build Windows installer
make package-mac   # Build macOS installer
make package-linux # Build Linux installer

# Database
make db-migrate    # Run migrations
make db-seed       # Seed database

# CLI
make cli-build     # Build standalone CLI
```

#### Design Strategy:
- Use npm/pnpm workspaces or similar
- Parallel execution where possible
- Clear error messages
- Cross-platform compatibility

### 8. Testing Strategy

Define **comprehensive testing architecture**:

#### Unit Tests
- Backend: Jest for services, controllers
- Frontend: Jest + React Testing Library / Vue Test Utils
- Coverage target: >80%

#### Integration Tests
- API endpoints (supertest)
- Database operations
- File system operations

#### E2E Tests
- User workflows (Playwright or Cypress?)
- Critical paths (create project, add page, export)
- Multi-browser testing

#### Test Structure
```
backend/
  src/
    users/
      users.service.ts
      users.service.spec.ts
      users.controller.ts
      users.controller.spec.ts
  test/
    e2e/
      users.e2e-spec.ts

frontend/
  src/
    components/
      Editor/
        Editor.tsx
        Editor.test.tsx
  e2e/
    workarea.spec.ts
```

#### CI/CD Testing
- Run on every PR
- Run on every push to main
- Code coverage reports
- Automated visual regression testing?

### 9. PR Preview Deployment

Define **complete PR preview architecture**:

#### GitHub Actions Workflow
```yaml
name: PR Preview Deploy

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy-preview:
    # ... define complete workflow
```

#### Requirements:
- Build frontend + backend
- Deploy to unique URL per PR
- Comment on PR with preview link
- Auto-cleanup on PR close
- Support for environment variables
- Database initialization

#### Hosting Options:
- Vercel (frontend + serverless backend?)
- Netlify + separate backend hosting?
- DigitalOcean App Platform?
- Custom solution with Docker + Traefik?

**Choose best option and justify.**

### 10. Database Architecture (SQLite Only)

Define **complete database schema** using TypeORM:

#### Core Entities
- User
- Project
- Page
- Block
- IDevice
- Theme
- File
- Translation
- UserPreference
- ProjectCollaborator
- OperationLog

#### Relationships
- User → Projects (one-to-many)
- Project → Pages (one-to-many)
- Page → Blocks (one-to-many)
- Project → Collaborators (many-to-many through ProjectCollaborator)

#### Migrations
- How to handle schema changes?
- Backward compatibility strategy
- Data migration scripts

#### Performance
- Indexes for common queries
- Full-text search for content?
- Query optimization strategies

### 11. Configuration Management

Define **configuration strategy** for different deployment modes:

#### Environment Variables
```bash
# App Mode
APP_MODE=online|offline
APP_DEPLOYMENT=multi-user|single-user

# Database
DATABASE_PATH=./data/exelearning.db

# Server
PORT=3000
HOST=localhost

# WebSocket
WEBSOCKET_PORT=3001

# Features
ENABLE_COLLABORATION=true|false
ENABLE_AUTH=true|false
ENABLE_GOOGLE_DRIVE=true|false
ENABLE_DROPBOX=true|false

# ... more
```

#### Config Files
- `.env.example`
- `.env.development`
- `.env.production`
- `.env.preview`

#### Runtime Configuration
- How does frontend know if it's online/offline?
- API endpoint to get configuration?
- Feature flags?

### 12. Shared Code Strategy

Define how to **share code between backend, frontend, CLI, and MCP**:

#### Shared Package Structure
```typescript
shared/
├── types/
│   ├── project.types.ts
│   ├── user.types.ts
│   ├── api.types.ts
│   └── ...
├── utils/
│   ├── validators.ts
│   ├── formatters.ts
│   └── ...
├── constants/
│   └── app.constants.ts
└── package.json
```

#### Build Strategy
- Use TypeScript project references?
- Monorepo tooling (Turborepo, Nx, pnpm workspaces)?
- How to ensure type safety across packages?

### 13. Export Architecture

Define **export system architecture** (critical feature):

#### Strategy Pattern
```typescript
interface ExportStrategy {
  export(project: Project, options: ExportOptions): Promise<Buffer>;
  validate(project: Project): ValidationResult;
}

class Scorm12ExportStrategy implements ExportStrategy { ... }
class Scorm2004ExportStrategy implements ExportStrategy { ... }
class Html5ExportStrategy implements ExportStrategy { ... }
class Epub3ExportStrategy implements ExportStrategy { ... }
```

#### Export Formats
- SCORM 1.2
- SCORM 2004
- HTML5
- HTML5 Single Page
- EPUB3
- IMS Content Package

#### Requirements:
- Generate manifest files (XML)
- Bundle assets
- Create ZIP archives
- Validate output
- Progress tracking
- Cancel support

### 14. Error Handling & Logging

Define **error handling and logging strategy**:

#### Error Types
- Validation errors
- Database errors
- File system errors
- Export errors
- Network errors
- Authentication errors

#### Logging
- Winston or Pino for backend?
- Frontend error logging (Sentry?)
- Log levels (debug, info, warn, error)
- Log rotation
- Centralized logging for cloud deployments

#### User-facing Errors
- Error messages translation
- Error codes
- Recovery suggestions

### 15. Security

Define **security architecture**:

#### Authentication
- JWT tokens
- Session management
- Password hashing (bcrypt)
- OAuth integration (Google, CAS, OIDC)

#### Authorization
- Role-based access control (RBAC)
- Resource-based permissions
- Guards and decorators

#### Security Best Practices
- SQL injection prevention (TypeORM parameterized queries)
- XSS prevention
- CSRF protection
- Rate limiting
- Input validation
- File upload security
- Helmet.js configuration

### 16. Performance Optimization

Define **performance strategies**:

#### Backend
- Database query optimization
- Caching (in-memory, Redis for cloud?)
- Lazy loading
- Pagination
- Compression

#### Frontend
- Code splitting
- Lazy loading routes/components
- Image optimization
- Asset caching
- Virtual scrolling for large lists

#### Build
- Tree shaking
- Minification
- Bundle analysis

### 17. Internationalization (i18n)

Define **i18n strategy**:

#### Backend
- nestjs-i18n or custom?
- Translation files structure
- Language detection

#### Frontend
- react-i18next or vue-i18n?
- Translation loading
- Language switching

#### Supported Languages
- English (default)
- Spanish
- French
- German
- ... (all current eXeLearning languages)

### 18. Documentation

Define **documentation strategy**:

#### Code Documentation
- JSDoc/TSDoc for functions
- README.md per package
- Architecture Decision Records (ADRs)

#### API Documentation
- OpenAPI/Swagger for REST API
- MCP tool definitions
- WebSocket events documentation

#### User Documentation
- Installation guide
- User manual
- Developer guide
- CLI reference

### 19. Development Workflow

Define **developer experience**:

#### Getting Started
```bash
git clone https://github.com/exelearning/exelearning.git
cd exelearning
make install
make dev
```

#### Hot Reload
- Backend: NestJS watch mode
- Frontend: Vite HMR
- Electron: electron-reload

#### Debugging
- VS Code launch configurations
- Chrome DevTools for frontend
- Node.js inspector for backend

#### Git Workflow
- Branch naming conventions
- Commit message format
- PR templates
- Code review checklist

### 20. Migration Strategy

Define **migration plan from eXeLearning 3.0 to 4.0**:

#### Data Migration
- SQLite database schema migration
- File migration (projects, assets)
- User data migration

#### Feature Parity
- Checklist of all current features
- Priority order for implementation
- Backward compatibility requirements

#### Rollout Plan
- Beta testing phase
- Gradual rollout
- Rollback strategy

## Deliverables

Provide the following in your architecture definition:

### 1. **Architecture Document** (Markdown)
   - Complete architecture overview
   - All sections above fully detailed
   - Diagrams (using Mermaid syntax)
   - Technology justifications

### 2. **Project Structure**
   - Complete folder structure (text tree)
   - File naming conventions
   - Module organization

### 3. **Database Schema**
   - Entity definitions (TypeORM decorators)
   - Entity Relationship Diagram (Mermaid)
   - Migration strategy

### 4. **API Specification**
   - All REST endpoints
   - Request/Response examples
   - WebSocket events

### 5. **Configuration Files**
   - TypeScript configs
   - Vite config
   - NestJS config
   - ESLint config
   - Jest config
   - Makefile (complete)

### 6. **Package.json Files**
   - Root package.json
   - Backend package.json
   - Frontend package.json
   - Shared package.json
   - CLI package.json
   - MCP package.json

### 7. **GitHub Actions Workflows**
   - CI/CD workflow
   - PR preview deployment workflow
   - Release workflow

### 8. **Type Definitions**
   - Shared TypeScript interfaces
   - API types
   - Database entity types

### 9. **Testing Strategy Document**
   - Test structure
   - Coverage requirements
   - E2E test scenarios

### 10. **Developer Guide**
   - Setup instructions
   - Development workflow
   - Contribution guidelines
   - Debugging guide

## Constraints & Requirements

### Must Have
- ✅ TypeScript everywhere (except Makefile)
- ✅ SQLite only (no MySQL/PostgreSQL)
- ✅ Single unified interface
- ✅ Online/offline mode toggle
- ✅ Makefile for project management
- ✅ PR preview deployment
- ✅ CLI support
- ✅ MCP support for AI
- ✅ Electron packaging
- ✅ Export to all current formats
- ✅ Real-time collaboration
- ✅ Comprehensive testing

### Must Not Have
- ❌ Docker (all JavaScript/TypeScript)
- ❌ Multiple separate UIs for online/offline
- ❌ Complex microservices architecture
- ❌ Multiple databases

### Principles
- 🎯 **Simplicity**: Easy to understand and maintain
- 🎯 **Modularity**: Clear separation of concerns
- 🎯 **Testability**: Everything should be testable
- 🎯 **Type Safety**: Leverage TypeScript fully
- 🎯 **Developer Experience**: Fast, easy, enjoyable
- 🎯 **AI-Friendly**: Clear patterns for AI code generation
- 🎯 **Performance**: Fast and responsive
- 🎯 **Scalability**: Can grow with user base

## Architecture Philosophy

Design the architecture with these principles:

1. **Convention over Configuration**
   - Predictable folder structure
   - Consistent naming patterns
   - Standard patterns throughout

2. **Composition over Inheritance**
   - Small, focused modules
   - Composable services
   - Dependency injection

3. **Fail Fast & Fail Loud**
   - Strict TypeScript
   - Validation at boundaries
   - Clear error messages

4. **Explicit over Implicit**
   - Clear dependencies
   - No magic
   - Obvious data flow

5. **Single Responsibility**
   - Each module does one thing
   - Clear boundaries
   - Minimal coupling

6. **DRY (Don't Repeat Yourself)**
   - Shared code in `shared/`
   - Reusable components
   - Utility functions

## Success Criteria

The architecture is successful if:

1. ✅ A developer can understand the project structure in < 30 minutes
2. ✅ `make dev` gets a developer running in < 5 minutes
3. ✅ `make test` runs all tests with >80% coverage
4. ✅ `make package` generates installers for all platforms
5. ✅ PR preview deploys work automatically
6. ✅ Online and offline modes work seamlessly
7. ✅ CLI can export projects independently
8. ✅ MCP server allows AI to generate content
9. ✅ All current eXeLearning 3.0 features are preserved
10. ✅ The codebase is maintainable by AI agents

## Output Format

Please provide your architecture definition in a **structured Markdown document** with:

- Clear headings and subheadings
- Mermaid diagrams where helpful
- Code examples in TypeScript
- Configuration file examples
- Command examples
- Tables for comparisons
- Checklists for requirements

**Start your response with an executive summary, then proceed with detailed sections.**

Be **opinionated** and make **clear technology choices** with justifications. This architecture will be used as the foundation for the entire migration project, so completeness and clarity are critical.

---

**Begin your architecture definition now.**

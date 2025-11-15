# Plan de Migración: eXeLearning de Symfony a NestJS

## Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Análisis de Equivalencias](#análisis-de-equivalencias)
3. [Arquitectura Objetivo](#arquitectura-objetivo)
4. [Plan de Migración por Fases](#plan-de-migración-por-fases)
5. [Estrategias de Migración](#estrategias-de-migración)
6. [Gestión de Datos](#gestión-de-datos)
7. [Riesgos y Mitigaciones](#riesgos-y-mitigaciones)
8. [Timeline Estimado](#timeline-estimado)
9. [Recursos Necesarios](#recursos-necesarios)

---

## Resumen Ejecutivo

### Estado Actual
eXeLearning utiliza **Symfony 7.3** (PHP 8.4) como framework backend con las siguientes características:

- **API Platform 4.2** para APIs REST modernas (`/api/v2`)
- **Doctrine ORM 3.5** para gestión de base de datos
- Soporte multi-base de datos (SQLite, MySQL, PostgreSQL)
- Sistema de autenticación multi-método (CAS, OIDC, JWT, API Keys)
- Integración con Mercure para tiempo real
- Servicios complejos de exportación educativa (SCORM, HTML5, EPUB3)
- ~123,777 líneas de código en el servicio principal (OdeService.php)

### Objetivo
Migrar completamente el backend a **NestJS** (TypeScript/Node.js) manteniendo:
- Toda la funcionalidad existente
- Compatibilidad con APIs actuales
- Mejoras en rendimiento y mantenibilidad
- Base de código moderna y escalable

### Beneficios Esperados
- **Stack unificado**: JavaScript/TypeScript en frontend y backend
- **Mejor performance**: Node.js asíncrono para operaciones I/O
- **Mejora en desarrollo**: Un solo lenguaje para todo el equipo
- **Ecosistema moderno**: NPM con miles de paquetes
- **WebSockets nativos**: Para colaboración en tiempo real
- **Mejor escalabilidad**: Arquitectura modular de NestJS

---

## Análisis de Equivalencias

### Tabla de Equivalencias Symfony → NestJS

| Componente Symfony | Equivalente NestJS | Notas |
|-------------------|-------------------|-------|
| **Framework Core** |
| FrameworkBundle | `@nestjs/core` | Core del framework |
| Kernel | `main.ts` + `AppModule` | Bootstrap de aplicación |
| Controllers | `@Controller()` | Decoradores similares |
| Services | `@Injectable()` | Inyección de dependencias |
| Dependency Injection | Built-in DI Container | Muy similar a Symfony |
| **Base de Datos** |
| Doctrine ORM | `TypeORM` o `Prisma` | TypeORM es más similar a Doctrine |
| Entities | `@Entity()` (TypeORM) | Decoradores en lugar de atributos |
| Repositories | `@Repository()` | Patrón repository nativo |
| DoctrineMigrationsBundle | TypeORM Migrations | Comandos CLI similares |
| Query Builder | TypeORM Query Builder | API fluida similar |
| **API REST** |
| API Platform | `@nestjs/swagger` + Custom | Necesita más código manual |
| API Resource | DTO + Controller | Más explícito |
| State Processors | Interceptors + Guards | Patrón diferente |
| Serialization | `class-transformer` | Decoradores similares |
| Validation | `class-validator` | Decoradores de validación |
| **Seguridad** |
| SecurityBundle | `@nestjs/passport` | Integración con Passport.js |
| Voters | Guards | Concepto similar |
| Access Token | JWT Strategy | `@nestjs/jwt` |
| Form Login | Local Strategy | Passport local |
| User Provider | UserService | Servicio personalizado |
| Password Hasher | `bcrypt` | Librería estándar |
| **Autenticación Avanzada** |
| CAS Authentication | `passport-cas` | Estrategia Passport |
| OIDC/OAuth2 | `passport-oauth2` + `openid-client` | Configuración manual |
| JWT Handler | `@nestjs/jwt` | Built-in |
| API Keys | Custom Guard | Implementación personalizada |
| **Routing** |
| Routes (annotations) | `@Get()`, `@Post()`, etc. | Decoradores muy similares |
| Route Parameters | `@Param()` | Decoradores |
| Query Parameters | `@Query()` | Decoradores |
| Request Body | `@Body()` | Decoradores |
| **Eventos** |
| EventSubscriber | Event Emitter (`@nestjs/event-emitter`) | Patrón observer |
| Doctrine Events | TypeORM Subscribers | Hooks de lifecycle |
| **Tiempo Real** |
| Mercure Bundle | `@nestjs/websockets` | WebSockets nativos |
| Server-Sent Events | SSE con NestJS | Soporte nativo |
| **Validación** |
| Symfony Validator | `class-validator` | Decoradores similares |
| Constraints | Validation decorators | API similar |
| **HTTP** |
| HTTP Client | `@nestjs/axios` | Wrapper de Axios |
| HTTP Foundation | Express/Fastify | Puede usar ambos |
| **Configuración** |
| .env + Parameters | `@nestjs/config` | ConfigModule |
| services.yaml | Providers array | Configuración en código |
| **CLI** |
| Console Commands | Custom CLI (Commander.js) | Menos integrado |
| bin/console | npm scripts | Diferentes |
| **Templates** |
| Twig | Handlebars/EJS/Pug | Si se necesita SSR |
| **Logging** |
| Monolog | `@nestjs/logger` o Winston | Múltiples opciones |
| **Testing** |
| PHPUnit | Jest | Testing framework de JS |
| Symfony Panther | Supertest | Testing HTTP |
| **Procesamiento Imágenes** |
| LiipImagineBundle | `sharp` | Librería Node.js |
| **Internacionalización** |
| Symfony Translation | `i18next` o `nestjs-i18n` | Diferentes enfoques |
| **Serialización** |
| Symfony Serializer | `class-transformer` | Similar |
| **Caching** |
| Symfony Cache | `@nestjs/cache-manager` | Redis, Memory, etc. |
| **Documentación API** |
| API Platform Docs | `@nestjs/swagger` | OpenAPI/Swagger |

### Dependencias Principales a Migrar

#### Core Dependencies
```json
{
  "@nestjs/core": "^10.0.0",
  "@nestjs/common": "^10.0.0",
  "@nestjs/platform-express": "^10.0.0",
  "reflect-metadata": "^0.1.13",
  "rxjs": "^7.8.1"
}
```

#### Database
```json
{
  "typeorm": "^0.3.20",
  "@nestjs/typeorm": "^10.0.0",
  "sqlite3": "^5.1.7",
  "mysql2": "^3.9.0",
  "pg": "^8.11.0"
}
```

#### Authentication
```json
{
  "@nestjs/passport": "^10.0.0",
  "@nestjs/jwt": "^10.0.0",
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "passport-jwt": "^4.0.1",
  "passport-oauth2": "^1.8.0",
  "passport-cas": "^0.1.1",
  "openid-client": "^5.6.0",
  "bcrypt": "^5.1.1"
}
```

#### API & Validation
```json
{
  "@nestjs/swagger": "^7.0.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.1"
}
```

#### WebSockets & Real-time
```json
{
  "@nestjs/websockets": "^10.0.0",
  "@nestjs/platform-socket.io": "^10.0.0",
  "socket.io": "^4.6.0"
}
```

#### Utilities
```json
{
  "@nestjs/config": "^3.0.0",
  "@nestjs/axios": "^3.0.0",
  "axios": "^1.6.0",
  "sharp": "^0.33.0",
  "archiver": "^6.0.0",
  "jszip": "^3.10.1"
}
```

---

## Arquitectura Objetivo

### Estructura de Directorios NestJS

```
backend/
├── src/
│   ├── main.ts                           # Bootstrap de aplicación
│   ├── app.module.ts                     # Módulo raíz
│   │
│   ├── config/                           # Configuración
│   │   ├── database.config.ts
│   │   ├── auth.config.ts
│   │   └── app.config.ts
│   │
│   ├── common/                           # Código compartido
│   │   ├── decorators/                   # Decoradores personalizados
│   │   ├── filters/                      # Exception filters
│   │   ├── guards/                       # Guards globales
│   │   ├── interceptors/                 # Interceptors
│   │   ├── pipes/                        # Pipes de validación
│   │   ├── interfaces/                   # Interfaces compartidas
│   │   └── constants/                    # Constantes
│   │
│   ├── database/                         # Base de datos
│   │   ├── entities/                     # Entidades TypeORM
│   │   │   ├── user.entity.ts
│   │   │   ├── project.entity.ts
│   │   │   ├── ode-components.entity.ts
│   │   │   └── ...
│   │   ├── migrations/                   # Migraciones
│   │   ├── repositories/                 # Repositorios custom
│   │   └── subscribers/                  # Event subscribers
│   │
│   ├── modules/                          # Módulos funcionales
│   │   │
│   │   ├── auth/                         # Autenticación
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/               # Passport strategies
│   │   │   │   ├── local.strategy.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── cas.strategy.ts
│   │   │   │   ├── oidc.strategy.ts
│   │   │   │   └── api-key.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       └── token.dto.ts
│   │   │
│   │   ├── users/                        # Gestión de usuarios
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   ├── update-user.dto.ts
│   │   │   │   └── user-quota.dto.ts
│   │   │   └── interfaces/
│   │   │       └── user.interface.ts
│   │   │
│   │   ├── projects/                     # Proyectos
│   │   │   ├── projects.module.ts
│   │   │   ├── projects.controller.ts
│   │   │   ├── projects.service.ts
│   │   │   ├── dto/
│   │   │   ├── pages/                    # Submódulo de páginas
│   │   │   │   ├── pages.controller.ts
│   │   │   │   ├── pages.service.ts
│   │   │   │   └── dto/
│   │   │   └── blocks/                   # Submódulo de bloques
│   │   │       ├── blocks.controller.ts
│   │   │       ├── blocks.service.ts
│   │   │       └── dto/
│   │   │
│   │   ├── ode/                          # ODE (core educativo)
│   │   │   ├── ode.module.ts
│   │   │   ├── ode.controller.ts
│   │   │   ├── ode.service.ts            # Migrar OdeService.php
│   │   │   ├── components/               # Componentes ODE
│   │   │   ├── navigation/               # Navegación
│   │   │   ├── structure/                # Estructura
│   │   │   └── dto/
│   │   │
│   │   ├── export/                       # Exportación
│   │   │   ├── export.module.ts
│   │   │   ├── export.controller.ts
│   │   │   ├── export-orchestrator.service.ts
│   │   │   ├── strategies/               # Strategy pattern
│   │   │   │   ├── html5.export.ts
│   │   │   │   ├── scorm12.export.ts
│   │   │   │   ├── scorm2004.export.ts
│   │   │   │   ├── epub3.export.ts
│   │   │   │   └── ims.export.ts
│   │   │   └── dto/
│   │   │
│   │   ├── elp/                          # ELP (archivos)
│   │   │   ├── elp.module.ts
│   │   │   ├── elp.controller.ts
│   │   │   ├── conversion.service.ts
│   │   │   ├── storage.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── filemanager/                  # Gestor de archivos
│   │   │   ├── filemanager.module.ts
│   │   │   ├── filemanager.controller.ts
│   │   │   ├── filemanager.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── templates/                    # Plantillas
│   │   │   ├── templates.module.ts
│   │   │   ├── templates.controller.ts
│   │   │   ├── templates.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── idevices/                     # iDevices
│   │   │   ├── idevices.module.ts
│   │   │   ├── idevices.controller.ts
│   │   │   ├── idevices.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── providers/                    # Integraciones LMS
│   │   │   ├── providers.module.ts
│   │   │   ├── providers.controller.ts
│   │   │   ├── providers.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── storage/                      # Almacenamiento cloud
│   │   │   ├── storage.module.ts
│   │   │   ├── google-drive/
│   │   │   │   ├── google-drive.controller.ts
│   │   │   │   └── google-drive.service.ts
│   │   │   └── dropbox/
│   │   │       ├── dropbox.controller.ts
│   │   │       └── dropbox.service.ts
│   │   │
│   │   ├── realtime/                     # Tiempo real
│   │   │   ├── realtime.module.ts
│   │   │   ├── realtime.gateway.ts       # WebSocket gateway
│   │   │   └── realtime.service.ts
│   │   │
│   │   ├── media/                        # Procesamiento multimedia
│   │   │   ├── media.module.ts
│   │   │   ├── image.service.ts          # Sharp para imágenes
│   │   │   └── thumbnail.service.ts
│   │   │
│   │   └── health/                       # Health checks
│   │       ├── health.module.ts
│   │       └── health.controller.ts
│   │
│   └── utils/                            # Utilidades
│       ├── archive/
│       │   └── zip-archiver.ts
│       ├── crypto/
│       └── validators/
│
├── test/                                 # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── migrations/                           # Migraciones TypeORM
├── .env.example                          # Variables de entorno
├── nest-cli.json                         # Configuración NestJS CLI
├── tsconfig.json                         # TypeScript config
├── package.json
└── README.md
```

### Arquitectura de Módulos

```
AppModule (root)
├── ConfigModule (global)
├── DatabaseModule (TypeORM)
├── AuthModule
│   ├── PassportModule
│   └── JwtModule
├── UsersModule
├── ProjectsModule
│   ├── PagesModule
│   └── BlocksModule
├── OdeModule
├── ExportModule
├── ElpModule
├── FilemanagerModule
├── TemplatesModule
├── IDevicesModule
├── ProvidersModule
├── StorageModule
├── RealtimeModule
├── MediaModule
└── HealthModule
```

### Flujo de Peticiones

```
Cliente HTTP Request
    ↓
Express/Fastify (Platform)
    ↓
Global Middlewares
    ↓
Global Guards (Authentication)
    ↓
Route Handler (Controller)
    ↓
Route Guards (Authorization)
    ↓
Interceptors (Before)
    ↓
Pipes (Validation/Transformation)
    ↓
Controller Method
    ↓
Service Layer
    ↓
Repository Layer
    ↓
TypeORM
    ↓
Database (SQLite/MySQL/PostgreSQL)
    ↓
Response
    ↓
Interceptors (After)
    ↓
Exception Filters (si hay error)
    ↓
Cliente HTTP Response
```

---

## Plan de Migración por Fases

### Estrategia General: **Migración Incremental con Coexistencia**

Se recomienda un enfoque de **strangler pattern** donde NestJS y Symfony coexisten durante la migración, permitiendo:
- Desarrollo incremental sin downtime
- Testing exhaustivo de cada módulo
- Rollback fácil en caso de problemas
- Migración de usuarios gradual

### Fase 0: Preparación (2-3 semanas)

#### Objetivos
- Configurar infraestructura NestJS
- Establecer entorno de desarrollo
- Configurar CI/CD para dual stack

#### Tareas
1. **Setup Proyecto NestJS**
   - Inicializar proyecto: `nest new backend`
   - Configurar TypeScript estricto
   - Setup linting (ESLint) y formatting (Prettier)
   - Configurar Git hooks (Husky)

2. **Configurar Base de Datos**
   - Instalar TypeORM
   - Migrar esquema de Doctrine a TypeORM
   - Configurar múltiples conexiones (SQLite, MySQL, PostgreSQL)
   - Crear script de migración de datos de prueba

3. **Configurar Variables de Entorno**
   - Crear `.env.example` con todas las variables
   - Documentar configuración
   - Setup `@nestjs/config`

4. **Setup Testing**
   - Configurar Jest
   - Crear tests básicos de infraestructura
   - Setup test database

5. **Documentación**
   - Crear ADRs (Architecture Decision Records)
   - Documentar estructura de módulos
   - Guía de contribución

#### Entregables
- ✅ Proyecto NestJS inicializado
- ✅ Base de datos configurada
- ✅ CI/CD pipeline configurado
- ✅ Documentación base

---

### Fase 1: Core & Autenticación (3-4 semanas)

#### Objetivos
- Migrar sistema de autenticación completo
- Establecer base para todos los módulos
- Validar arquitectura de seguridad

#### Tareas

**1.1 Entidades Base**
- Migrar entidad `User` a TypeORM
- Migrar `UserPreferences`
- Crear repositorios personalizados
- Implementar soft deletes y timestamps

**1.2 Módulo de Usuarios**
- `UsersModule`: CRUD de usuarios
- `UsersService`: lógica de negocio
- `UsersController`: endpoints `/api/v2/users`
- DTOs con validación (class-validator)
- Tests unitarios e integración

**1.3 Autenticación Local**
- `AuthModule` base
- `LocalStrategy` (login usuario/password)
- `JwtStrategy` (tokens JWT)
- Guards: `JwtAuthGuard`, `RolesGuard`
- Password hashing con bcrypt
- Endpoints: `/api/v2/auth/token`, `/api/session/check`

**1.4 Autenticación Avanzada**
- `CasStrategy` para CAS
- `OidcStrategy` para OpenID Connect
- `ApiKeyStrategy` para API Keys
- Auto-creación de usuarios externos
- Sincronización de datos externos

**1.5 Guards y Decoradores**
- `@Public()` decorator
- `@Roles()` decorator
- `@CurrentUser()` decorator
- `RolesGuard` para autorización
- Exception filters personalizados

**1.6 Testing**
- Tests de cada estrategia
- Tests de guards
- Tests E2E de autenticación completa
- Tests de integración con todas las BDs

#### Endpoints a Migrar
```
POST   /api/v2/auth/token
GET    /api/session/check
POST   /login
POST   /logout
GET    /api/v2/users
POST   /api/v2/users
GET    /api/v2/users/:id
PATCH  /api/v2/users/:id
DELETE /api/v2/users/:id
PATCH  /api/v2/users/:id/quota
GET    /api/v2/users/:id/stats
```

#### Criterios de Éxito
- ✅ Todos los métodos de autenticación funcionan
- ✅ Tests >80% cobertura
- ✅ Compatible con frontend existente
- ✅ Documentación Swagger completa

---

### Fase 2: Proyectos & Estructura ODE (4-5 semanas)

#### Objetivos
- Migrar gestión de proyectos educativos
- Implementar estructura ODE (núcleo educativo)
- Establecer arquitectura de contenidos

#### Tareas

**2.1 Entidades de Proyecto**
- Migrar entidades:
  - `ProjectProperty`
  - `OdeComponentsSync`
  - `OdeNavStructureSync`
  - `OdePagStructureSync`
  - `OdePropertiesSync`
  - `OdeFiles`
- Relaciones entre entidades
- Índices y optimizaciones

**2.2 Módulo de Proyectos**
- `ProjectsModule`
- `ProjectsService`: lógica CRUD
- `ProjectsController`: endpoints REST
- `ProjectPropertiesBuilder`: construcción de propiedades
- DTOs y validaciones
- Paginación y filtrado

**2.3 Módulo de Páginas**
- `PagesModule` (submódulo de Projects)
- `PagesService`
- `PagesController`
- Gestión de jerarquía de páginas
- Reordenamiento

**2.4 Módulo de Bloques**
- `BlocksModule` (submódulo de Projects)
- `BlocksService`
- `BlocksController`
- Tipos de bloques
- Validación de contenido

**2.5 Módulo ODE Core**
- `OdeModule`: núcleo educativo
- `OdeService`: migrar lógica de OdeService.php (CRÍTICO - 123K líneas)
  - Dividir en servicios más pequeños:
    - `OdeComponentsService`
    - `OdeNavigationService`
    - `OdeStructureService`
    - `OdePropertiesService`
    - `OdeOperationsService`
- `OdeController`: endpoints legacy
- Event subscribers para sincronización
- Logging de operaciones

**2.6 Testing**
- Tests de cada módulo
- Tests de integridad de datos
- Tests de concurrencia
- Performance testing

#### Endpoints a Migrar
```
GET    /api/v2/projects
POST   /api/v2/projects
GET    /api/v2/projects/:id
PATCH  /api/v2/projects/:id
DELETE /api/v2/projects/:id

# Páginas
GET    /api/v2/projects/:projectId/pages
POST   /api/v2/projects/:projectId/pages
PATCH  /api/v2/pages/:id
DELETE /api/v2/pages/:id

# Bloques
GET    /api/v2/pages/:pageId/blocks
POST   /api/v2/pages/:pageId/blocks
PATCH  /api/v2/blocks/:id
DELETE /api/v2/blocks/:id

# ODE Legacy
GET/POST /api/ode/*
```

#### Criterios de Éxito
- ✅ CRUD completo de proyectos
- ✅ Navegación y estructura funcionan
- ✅ Compatible con datos existentes
- ✅ Performance similar o mejor que Symfony

---

### Fase 3: Exportación & Conversión (3-4 semanas)

#### Objetivos
- Migrar todos los formatos de exportación
- Implementar conversión de archivos ELP
- Mantener compatibilidad de formatos

#### Tareas

**3.1 Estrategia de Exportación**
- Crear interfaz base `ExportStrategy`
- Implementar Strategy Pattern para cada formato
- `ExportOrchestratorService`: coordinación

**3.2 Exportadores**
- `Html5ExportStrategy`: HTML5 estático
- `Html5SpExportStrategy`: HTML5 Single Page
- `Scorm12ExportStrategy`: SCORM 1.2
- `Scorm2004ExportStrategy`: SCORM 2004
- `Epub3ExportStrategy`: EPUB3
- `ImsExportStrategy`: IMS Content Package

**3.3 Módulo ELP**
- `ElpModule`
- `ElpConversionService`: conversión de archivos
- `ElpStorageService`: almacenamiento temporal
- `EphemeralUserManager`: usuarios temporales
- Limpieza automática de archivos

**3.4 Archivado**
- `ZipArchiverService`: compresión
- Usar librerías: `archiver`, `jszip`
- Streaming para archivos grandes

**3.5 Testing**
- Tests de cada exportador
- Validación de formatos
- Tests de archivos reales
- Performance de archivos grandes

#### Endpoints a Migrar
```
POST   /api/v2/export/elp
POST   /api/v2/convert/elp
GET    /api/v2/export/:format/:projectId
```

#### Criterios de Éxito
- ✅ Todos los formatos exportan correctamente
- ✅ Archivos compatibles con versión PHP
- ✅ Performance aceptable en archivos grandes
- ✅ Manejo de errores robusto

---

### Fase 4: FileManager & Media (2-3 semanas)

#### Objetivos
- Migrar gestor de archivos
- Implementar procesamiento de imágenes
- Gestión de recursos multimedia

#### Tareas

**4.1 FileManager**
- `FilemanagerModule`
- `FilemanagerService`: operaciones CRUD de archivos
- Upload de archivos (multipart/form-data)
- Validación de tipos y tamaños
- Gestión de permisos

**4.2 Procesamiento de Imágenes**
- `MediaModule`
- `ImageService`: usar `sharp`
- Redimensionado
- Generación de thumbnails
- Optimización automática
- Conversión de formatos

**4.3 Almacenamiento**
- Abstracción de almacenamiento
- Soporte para local filesystem
- Preparar para S3/Cloud storage futuro

**4.4 Testing**
- Tests de upload
- Tests de procesamiento
- Tests de límites de tamaño

#### Endpoints a Migrar
```
POST   /api/filemanager/upload
GET    /api/filemanager/list
DELETE /api/filemanager/delete
GET    /api/filemanager/download
```

#### Criterios de Éxito
- ✅ Upload funciona correctamente
- ✅ Imágenes se procesan bien
- ✅ Límites de cuota respetados
- ✅ Seguridad validada

---

### Fase 5: Plantillas & iDevices (2-3 semanas)

#### Objetivos
- Migrar sistema de plantillas
- Implementar iDevices
- Temas personalizables

#### Tareas

**5.1 Plantillas**
- `TemplatesModule`
- `TemplatesService`
- `TemplatesController`
- CRUD de plantillas
- Validación de estructura

**5.2 iDevices**
- `IDevicesModule`
- `IDevicesService`
- Catálogo de iDevices
- Validación de configuración
- Renderizado

**5.3 Temas**
- `ThemesService`
- Gestión de temas
- Personalización

**5.4 Testing**
- Tests de plantillas
- Tests de iDevices
- Tests de validación

#### Endpoints a Migrar
```
GET    /api/v2/templates
POST   /api/v2/templates
GET    /api/idevices
POST   /api/idevices
GET    /api/themes
```

#### Criterios de Éxito
- ✅ Plantillas funcionan
- ✅ iDevices renderizan bien
- ✅ Temas aplicables

---

### Fase 6: Integraciones Externas (3-4 semanas)

#### Objetivos
- Migrar integraciones con LMS
- Implementar OAuth para cloud storage
- Mantener compatibilidad con plataformas

#### Tareas

**6.1 Providers (LMS)**
- `ProvidersModule`
- `ProvidersService`
- Integración multi-tenant
- JWT para comunicación
- Validación de tokens
- Estadísticas

**6.2 Google Drive**
- `GoogleDriveService`
- OAuth 2.0 flow
- Upload/Download
- Gestión de permisos

**6.3 Dropbox**
- `DropboxService`
- OAuth 2.0 flow
- Sincronización

**6.4 openEQUELLA**
- `EquellaService`
- Integración con repositorio
- Metadatos

**6.5 Testing**
- Tests con mocks de APIs
- Tests de OAuth flow
- Tests de integración

#### Endpoints a Migrar
```
GET    /api/providers/validate
GET    /api/providers/statistics
POST   /api/providers/jwt/generate
GET    /api/google-drive/auth
POST   /api/google-drive/upload
GET    /api/dropbox/auth
```

#### Criterios de Éxito
- ✅ Integraciones LMS funcionan
- ✅ OAuth flows completos
- ✅ Sincronización correcta

---

### Fase 7: Tiempo Real & Colaboración (2-3 semanas)

#### Objetivos
- Migrar de Mercure a WebSockets nativos
- Implementar colaboración en tiempo real
- Notificaciones push

#### Tareas

**7.1 WebSockets**
- `RealtimeModule`
- `RealtimeGateway`: WebSocket gateway
- Rooms por proyecto
- Autenticación de sockets
- Manejo de reconexiones

**7.2 Colaboración**
- `CollaborationService`
- Presencia de usuarios
- Cambios en tiempo real
- Resolución de conflictos
- Operational Transformation (opcional)

**7.3 Notificaciones**
- Sistema de notificaciones
- Broadcast de eventos
- SSE como fallback

**7.4 Testing**
- Tests de WebSocket
- Tests de concurrencia
- Load testing

#### Eventos a Implementar
```
project:update
page:create
page:update
block:update
user:presence
notification:new
```

#### Criterios de Éxito
- ✅ WebSockets estables
- ✅ Colaboración funciona
- ✅ Performance bajo carga

---

### Fase 8: Utilidades & Legacy (2 semanas)

#### Objetivos
- Migrar utilidades restantes
- Endpoints legacy
- Configuración

#### Tareas

**8.1 Configuración**
- `ConfigController`
- Upload limits
- App settings
- Feature flags

**8.2 Health Checks**
- `HealthModule`
- Database health
- Service health
- Metrics

**8.3 Comandos CLI**
- Crear usuarios
- Generar API keys
- Migraciones
- Limpieza de datos

**8.4 Testing**
- Tests de utilidades
- Tests de health checks

#### Criterios de Éxito
- ✅ Todos los endpoints migrados
- ✅ Health checks funcionan
- ✅ CLI útiles

---

### Fase 9: Testing & Optimización (2-3 semanas)

#### Objetivos
- Testing exhaustivo
- Optimización de performance
- Seguridad

#### Tareas

**9.1 Testing Completo**
- Tests E2E de todos los flujos
- Tests de carga (Artillery, k6)
- Tests de seguridad (OWASP)
- Tests de compatibilidad

**9.2 Performance**
- Profiling de queries lentas
- Caching (Redis)
- Optimización de índices DB
- Lazy loading
- Query optimization

**9.3 Seguridad**
- Audit de dependencias
- Rate limiting
- CORS configurado
- Helmet.js
- Validación exhaustiva
- SQL injection prevention
- XSS prevention

**9.4 Documentación**
- Swagger completo
- Guías de migración
- Troubleshooting
- Performance tuning guide

#### Criterios de Éxito
- ✅ Tests >85% cobertura
- ✅ Performance benchmarks superados
- ✅ Security audit passed
- ✅ Documentación completa

---

### Fase 10: Deployment & Migration (2-3 semanas)

#### Objetivos
- Despliegue gradual
- Migración de datos
- Switchover final

#### Tareas

**10.1 Preparación**
- Backup completo de datos
- Dry-run de migración
- Rollback plan
- Comunicación a usuarios

**10.2 Migración de Datos**
- Script de migración de BD
- Validación de integridad
- Migración de archivos
- Testing post-migración

**10.3 Deployment**
- Deploy NestJS en paralelo a Symfony
- Proxy reverso para routing
- Monitoreo intensivo
- Gradual traffic shifting

**10.4 Switchover**
- Migrar tráfico gradualmente (10%, 25%, 50%, 100%)
- Monitoreo de errores
- Ajustes en caliente
- Deprecar endpoints Symfony

**10.5 Post-Migration**
- Monitoreo 24/7 primera semana
- Hotfixes rápidos
- Feedback de usuarios
- Documentación de issues

#### Criterios de Éxito
- ✅ Zero data loss
- ✅ Downtime <1 hora
- ✅ No errores críticos
- ✅ Performance igual o mejor

---

## Estrategias de Migración

### 1. Migración de OdeService.php (CRÍTICO)

El archivo `OdeService.php` tiene **123,777 líneas** y es el núcleo del sistema. Estrategia:

#### Análisis Previo
1. Analizar dependencias y responsabilidades
2. Identificar métodos públicos vs privados
3. Agrupar por funcionalidad
4. Detectar código duplicado

#### Refactorización
Dividir en servicios especializados:

```typescript
// Antes (Symfony - 123K líneas)
OdeService.php

// Después (NestJS - múltiples servicios)
ode/
├── ode.service.ts              // Orchestrador (500 líneas)
├── components/
│   └── ode-components.service.ts    // ~5K líneas
├── navigation/
│   └── ode-navigation.service.ts    // ~8K líneas
├── structure/
│   ├── ode-structure.service.ts     // ~10K líneas
│   └── ode-page-structure.service.ts // ~8K líneas
├── properties/
│   └── ode-properties.service.ts    // ~5K líneas
├── operations/
│   ├── ode-operations.service.ts    // ~10K líneas
│   └── ode-operations-log.service.ts // ~2K líneas
├── sync/
│   ├── ode-sync.service.ts          // ~15K líneas
│   └── ode-sync-changes.service.ts  // ~5K líneas
├── files/
│   └── ode-files.service.ts         // ~8K líneas
└── current-users/
    └── current-ode-users.service.ts // ~5K líneas
```

#### Ventajas de la División
- **Testabilidad**: cada servicio es testeable independientemente
- **Mantenibilidad**: código más legible y organizado
- **Escalabilidad**: servicios pueden escalar independientemente
- **Reutilización**: lógica compartida en servicios comunes

#### Plan de Migración
1. **Semana 1-2**: Análisis y diseño de arquitectura
2. **Semana 3-4**: Migrar núcleo (`ode.service.ts`)
3. **Semana 5-6**: Migrar components y navigation
4. **Semana 7-8**: Migrar structure y properties
5. **Semana 9-10**: Migrar operations y sync
6. **Semana 11-12**: Migrar files y current-users
7. **Semana 13-14**: Testing integración y refactorización

### 2. Coexistencia Symfony-NestJS

Durante la migración, ambos sistemas coexistirán:

#### Arquitectura de Proxy

```
                    ┌─────────────────┐
                    │  Nginx/HAProxy  │
                    │   (Port 80/443) │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │  NestJS (3000)   │      │ Symfony (8000)   │
    │  (New API)       │      │ (Legacy API)     │
    └──────────────────┘      └──────────────────┘
                │                         │
                └────────────┬────────────┘
                             ▼
                    ┌─────────────────┐
                    │    Database     │
                    │ (SQLite/MySQL)  │
                    └─────────────────┘
```

#### Configuración Nginx

```nginx
upstream nestjs {
    server localhost:3000;
}

upstream symfony {
    server localhost:8000;
}

server {
    listen 80;

    # NestJS - APIs migradas
    location ~ ^/api/v2/(users|auth|projects) {
        proxy_pass http://nestjs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Symfony - APIs legacy
    location /api {
        proxy_pass http://symfony;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSockets - NestJS
    location /socket.io {
        proxy_pass http://nestjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Frontend
    location / {
        proxy_pass http://symfony;
    }
}
```

### 3. Migración de Base de Datos

#### Estrategia: Schema First

1. **Exportar schema de Doctrine**
   ```bash
   php bin/console doctrine:schema:dump
   ```

2. **Generar entidades TypeORM**
   - Convertir atributos PHP a decoradores TS
   - Mantener mismo nombre de tablas y columnas
   - Preservar relaciones

3. **Sincronización de datos**
   - Ambos sistemas acceden a la misma BD
   - No hay migración de datos necesaria
   - Compatibilidad total

#### Ejemplo de Migración de Entidad

**Antes (Symfony - PHP):**
```php
<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'users')]
class User
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 180, unique: true)]
    private ?string $email = null;

    #[ORM\Column(type: 'json')]
    private array $roles = [];

    #[ORM\Column(type: 'string')]
    private ?string $password = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $quotaMb = null;

    // getters y setters...
}
```

**Después (NestJS - TypeScript):**
```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 180, unique: true })
  email: string;

  @Column({ type: 'json' })
  roles: string[];

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'integer', nullable: true, name: 'quota_mb' })
  quotaMb: number | null;
}
```

### 4. Migración de Autenticación Multi-método

#### Configuración de Strategies

```typescript
// auth/strategies/multi-token.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';

@Injectable()
export class MultiTokenStrategy extends PassportStrategy(Strategy, 'multi-token') {
  constructor(
    private casService: CasService,
    private oidcService: OidcService,
    private jwtService: JwtTokenService,
    private apiKeyService: ApiKeyService,
  ) {
    super();
  }

  async validate(req: Request): Promise<any> {
    // 1. Check CAS ticket
    const ticket = req.query.ticket as string;
    if (ticket && (ticket.startsWith('ST-') || ticket.startsWith('PT-'))) {
      return await this.casService.validateTicket(ticket);
    }

    // 2. Check Bearer token (JWT)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return await this.jwtService.validateToken(token);
    }

    // 3. Check OIDC token
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        return await this.oidcService.validateToken(token);
      } catch (e) {
        // Continue to next method
      }
    }

    // 4. Check API Key
    const apiKey = req.query.access_token as string || req.headers['x-api-key'];
    if (apiKey) {
      return await this.apiKeyService.validateApiKey(apiKey);
    }

    return null;
  }
}
```

### 5. Migración de Exportadores

Usar **Strategy Pattern**:

```typescript
// export/interfaces/export-strategy.interface.ts
export interface ExportStrategy {
  export(project: Project, options: ExportOptions): Promise<Buffer>;
  getFormat(): string;
  getMimeType(): string;
}

// export/strategies/scorm12.export.ts
@Injectable()
export class Scorm12ExportStrategy implements ExportStrategy {
  async export(project: Project, options: ExportOptions): Promise<Buffer> {
    // 1. Generate manifest
    const manifest = this.generateManifest(project);

    // 2. Convert pages to SCO format
    const scos = await this.convertToScos(project.pages);

    // 3. Create ZIP
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifest);
    // ... add files

    return await zip.generateAsync({ type: 'nodebuffer' });
  }

  getFormat(): string {
    return 'scorm12';
  }

  getMimeType(): string {
    return 'application/zip';
  }
}

// export/export.service.ts
@Injectable()
export class ExportService {
  private strategies: Map<string, ExportStrategy>;

  constructor(
    @Inject('EXPORT_STRATEGIES') strategies: ExportStrategy[],
  ) {
    this.strategies = new Map(
      strategies.map(s => [s.getFormat(), s])
    );
  }

  async export(format: string, project: Project): Promise<Buffer> {
    const strategy = this.strategies.get(format);
    if (!strategy) {
      throw new BadRequestException(`Format ${format} not supported`);
    }
    return await strategy.export(project, {});
  }
}
```

---

## Gestión de Datos

### 1. Migraciones TypeORM

Configuración:

```typescript
// config/database.config.ts
export const databaseConfig: TypeOrmModuleOptions = {
  type: process.env.DB_DRIVER as any || 'sqlite',
  database: process.env.DB_PATH || 'data/exelearning.db',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
  migrationsRun: false,
  synchronize: false, // NEVER true in production
  logging: process.env.NODE_ENV === 'development',
};
```

Generar migración:
```bash
npm run typeorm migration:generate -- -n MigrationName
```

### 2. Compatibilidad de Schema

Mantener **exactamente** los mismos nombres:
- Tablas: `users`, `ode_components_sync`, etc.
- Columnas: `quota_mb`, `external_identifier`, etc.
- Tipos de datos compatibles

### 3. Transacciones

Usar decorador `@Transaction()`:

```typescript
import { Transaction, TransactionRepository } from 'typeorm';

@Injectable()
export class ProjectsService {
  @Transaction()
  async createProject(
    @TransactionRepository(Project) projectRepo: Repository<Project>,
    @TransactionRepository(Page) pageRepo: Repository<Page>,
    dto: CreateProjectDto,
  ): Promise<Project> {
    const project = projectRepo.create(dto);
    await projectRepo.save(project);

    // Create default page
    const page = pageRepo.create({
      project,
      title: 'Home',
      order: 1,
    });
    await pageRepo.save(page);

    return project;
  }
}
```

### 4. Seeding

Crear seeders para datos de prueba:

```typescript
// database/seeds/user.seeder.ts
export class UserSeeder {
  async run(dataSource: DataSource): Promise<void> {
    const userRepo = dataSource.getRepository(User);

    const admin = userRepo.create({
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      roles: ['ROLE_ADMIN'],
      quotaMb: 1000,
    });

    await userRepo.save(admin);
  }
}
```

---

## Riesgos y Mitigaciones

### Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Incompatibilidad de datos** | Media | Alto | Testing exhaustivo, validación de schema, rollback plan |
| **Performance degradation** | Media | Alto | Benchmarking continuo, profiling, optimización de queries |
| **Bugs en migración** | Alta | Medio | Tests E2E completos, QA manual, staged rollout |
| **Pérdida de funcionalidad** | Baja | Alto | Checklist de features, tests de regresión |
| **Incompatibilidad de archivos exportados** | Media | Alto | Validación de formatos, tests con archivos reales |
| **Problemas de autenticación** | Media | Alto | Tests con todos los métodos, sandbox environment |
| **Corrupción de base de datos** | Baja | Crítico | Backups automáticos, transacciones, validación |
| **Downtime prolongado** | Media | Alto | Migración incremental, rollback rápido |
| **Dependencias incompatibles** | Media | Medio | Audit de dependencias, versions lockfile |

### Riesgos de Negocio

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Rechazo de usuarios** | Baja | Alto | Comunicación clara, documentación, soporte |
| **Pérdida de productividad** | Media | Medio | Training, gradual rollout, soporte 24/7 |
| **Coste excesivo** | Media | Medio | Planning detallado, sprints cortos, seguimiento |
| **Timeline sobrepasado** | Alta | Medio | Buffer en planning, priorización, equipo adicional |
| **Falta de recursos** | Media | Alto | Planificación de recursos, outsourcing si necesario |

### Plan de Rollback

En caso de problemas críticos:

1. **Detección** (< 5 minutos)
   - Monitoreo automático detecta errores
   - Alertas a equipo DevOps
   - Evaluación de severidad

2. **Decisión** (< 10 minutos)
   - ¿Es crítico?
   - ¿Afecta a todos los usuarios?
   - ¿Hay solución rápida?

3. **Rollback** (< 15 minutos)
   - Cambiar proxy a 100% Symfony
   - Validar funcionamiento
   - Comunicar a usuarios

4. **Post-mortem** (< 24 horas)
   - Análisis de causa raíz
   - Documentación
   - Plan de corrección

---

## Timeline Estimado

### Resumen por Fases

| Fase | Duración | Semanas Acumuladas | Porcentaje |
|------|----------|-------------------|------------|
| 0. Preparación | 2-3 semanas | 3 | 8% |
| 1. Core & Auth | 3-4 semanas | 7 | 19% |
| 2. Proyectos & ODE | 4-5 semanas | 12 | 33% |
| 3. Exportación | 3-4 semanas | 16 | 44% |
| 4. FileManager | 2-3 semanas | 19 | 53% |
| 5. Plantillas | 2-3 semanas | 22 | 61% |
| 6. Integraciones | 3-4 semanas | 26 | 72% |
| 7. Tiempo Real | 2-3 semanas | 29 | 81% |
| 8. Legacy | 2 semanas | 31 | 86% |
| 9. Testing | 2-3 semanas | 34 | 94% |
| 10. Deployment | 2-3 semanas | 36 | 100% |

**Total: 27-38 semanas (6-9 meses)**

### Timeline Visual (Gantt simplificado)

```
Mes 1  ████ Preparación + Auth (inicio)
Mes 2  ████ Auth (fin) + Proyectos (inicio)
Mes 3  ████ Proyectos + ODE
Mes 4  ████ ODE (fin) + Exportación
Mes 5  ████ FileManager + Plantillas
Mes 6  ████ Integraciones + Tiempo Real
Mes 7  ████ Legacy + Testing (inicio)
Mes 8  ████ Testing (fin) + Deployment (inicio)
Mes 9  ████ Deployment + Estabilización
```

### Hitos Críticos

- **Mes 2**: Autenticación completa ✓
- **Mes 4**: ODE Service migrado ✓
- **Mes 5**: Exportación funcionando ✓
- **Mes 7**: Feature complete ✓
- **Mes 8**: QA passed ✓
- **Mes 9**: Producción ✓

---

## Recursos Necesarios

### Equipo Recomendado

#### Core Team (6-8 personas)

1. **Tech Lead / Architect** (1)
   - Experiencia en Symfony y NestJS
   - Decisiones arquitectónicas
   - Code reviews
   - Tiempo: 100%

2. **Backend Developers** (3-4)
   - Experiencia en TypeScript/Node.js
   - Conocimiento de NestJS
   - Migración de módulos
   - Tiempo: 100%

3. **DevOps Engineer** (1)
   - CI/CD setup
   - Infraestructura
   - Monitoreo
   - Tiempo: 50-100%

4. **QA Engineer** (1)
   - Testing manual y automatizado
   - Test plans
   - Bug tracking
   - Tiempo: 100%

5. **DBA / Data Engineer** (0.5)
   - Migraciones de BD
   - Optimización de queries
   - Backup/restore
   - Tiempo: 50%

#### Support Team (2-3 personas)

6. **Product Owner** (1)
   - Priorización
   - Decisiones de negocio
   - Comunicación con stakeholders
   - Tiempo: 25-50%

7. **Technical Writer** (0.5)
   - Documentación
   - Guías de usuario
   - API docs
   - Tiempo: 50%

### Infraestructura

#### Desarrollo
- **Servidores de desarrollo**: 2-3 VMs
- **Bases de datos**: SQLite, MySQL, PostgreSQL (dev)
- **CI/CD**: GitHub Actions / GitLab CI
- **Monitoreo**: Sentry, DataDog / New Relic

#### Staging
- **Ambiente de staging**: réplica de producción
- **Base de datos**: copia de producción
- **Load balancer**: Nginx

#### Producción
- **Servidores**: 2-4 instancias (HA)
- **Base de datos**: cluster con replicación
- **CDN**: para assets estáticos
- **Monitoreo 24/7**: alertas, logs, métricas

### Costes Estimados

#### Personal (9 meses)
- Tech Lead: 9 meses × $X
- Backend Devs (4): 36 meses × $Y
- DevOps: 6 meses × $Z
- QA: 9 meses × $W
- Total: Depende de salarios locales

#### Infraestructura
- Desarrollo: ~$500/mes × 9 = $4,500
- Staging: ~$1,000/mes × 6 = $6,000
- Producción: ~$2,000/mes × 9 = $18,000
- Total: ~$28,500

#### Herramientas y Servicios
- Monitoreo (Sentry, DataDog): ~$300/mes × 9 = $2,700
- CI/CD: incluido en GitHub/GitLab
- Total: ~$3,000

**Coste total estimado**: Personal + $31,500

---

## Recomendaciones Finales

### 1. Comenzar con Fase 0 Inmediatamente
- Setup de proyecto
- Configuración de infraestructura
- Formación del equipo

### 2. Priorizar ODE Service
- Es el componente más crítico (123K líneas)
- Requiere más tiempo y atención
- Dividir en servicios pequeños es clave

### 3. Mantener Compatibilidad
- APIs deben ser 100% compatibles
- Misma estructura de datos
- Mismo comportamiento

### 4. Testing Exhaustivo
- >85% cobertura de código
- Tests E2E de todos los flujos
- Performance testing
- Security testing

### 5. Monitoreo Continuo
- Métricas en tiempo real
- Alertas configuradas
- Logging detallado
- Tracing distribuido

### 6. Comunicación Constante
- Stakeholders informados
- Usuarios preparados
- Equipo sincronizado
- Documentación actualizada

### 7. Rollout Gradual
- No hacer big bang
- Migrar por módulos
- Validar cada fase
- Rollback plan siempre listo

### 8. Post-Migration Support
- Soporte 24/7 primera semana
- Hotfixes rápidos
- Monitoreo intensivo
- Feedback loop con usuarios

---

## Conclusión

La migración de eXeLearning de Symfony a NestJS es un proyecto **ambicioso pero viable** que tomará aproximadamente **6-9 meses** con el equipo adecuado.

### Ventajas de la Migración
✅ Stack unificado JavaScript/TypeScript
✅ Mejor performance con Node.js
✅ Ecosistema moderno y rico
✅ WebSockets nativos
✅ Arquitectura más escalable
✅ Mejor experiencia de desarrollo

### Desafíos Principales
⚠️ Migración de OdeService.php (123K líneas)
⚠️ Mantener compatibilidad total
⚠️ Testing exhaustivo necesario
⚠️ Coordinación de equipo grande
⚠️ Gestión de riesgos continua

### Claves del Éxito
🔑 Planificación detallada (este documento)
🔑 Equipo experimentado
🔑 Migración incremental
🔑 Testing continuo
🔑 Monitoreo exhaustivo
🔑 Comunicación efectiva

Con este plan, eXeLearning puede modernizar su stack tecnológico manteniendo toda la funcionalidad existente y preparándose para un futuro más escalable y mantenible.

---

**Documento creado**: 2025-11-15
**Versión**: 1.0
**Estado**: Plan Inicial
**Próximos pasos**: Revisión con stakeholders → Aprobación → Inicio Fase 0

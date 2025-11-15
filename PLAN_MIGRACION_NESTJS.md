# Plan de Migración: eXeLearning de Symfony a NestJS

## Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura Real Actual](#arquitectura-real-actual)
3. [Análisis de Equivalencias](#análisis-de-equivalencias)
4. [Arquitectura Objetivo NestJS](#arquitectura-objetivo-nestjs)
5. [Plan de Migración por Fases](#plan-de-migración-por-fases)
6. [Migración de Plantillas Twig](#migración-de-plantillas-twig)
7. [Integración con Electron](#integración-con-electron)
8. [Riesgos y Mitigaciones](#riesgos-y-mitigaciones)
9. [Timeline Estimado](#timeline-estimado)
10. [Recursos Necesarios](#recursos-necesarios)

---

## Resumen Ejecutivo

### Arquitectura Actual Descubierta

eXeLearning es una **aplicación de escritorio Electron** con:
- **Backend**: Symfony 7.3 (PHP 8.4) con PHP runtime embebido
- **Frontend**: JavaScript vanilla ES6 (NO React/Vue/Angular)
- **Tipo de app**: Híbrida Server-Side Rendering + SPA
- **Render inicial**: Symfony/Twig renderiza `/workarea` UNA VEZ con todo el HTML
- **Operación**: JavaScript toma control y usa API REST para todo
- **Plantillas**: Solo 1 plantilla Twig principal (`workarea.html.twig`)
- **APIs**: 69 controladores legacy en `/api/*` (NO `/api/v2` - no se usa)
- **Tiempo real**: Mercure (WebSockets)

### Objetivo de la Migración

Migrar el backend Symfony a **NestJS** (TypeScript/Node.js) manteniendo:
1. **Compatibilidad 100%** con frontend JavaScript vanilla existente
2. **Misma estructura de APIs** (`/api/*`)
3. **Integración con Electron** (cambiar PHP por Node.js)
4. **Plantilla workarea** (Twig → **Nunjucks**, NO TSX)
5. **WebSockets** (Mercure → Socket.io)
6. **Toda la funcionalidad** actual

### Simplificación Importante

❌ **NO migrar**:
- API Platform (no se usa)
- Endpoints `/api/v2/*` (no existen en uso real)
- Frontend JavaScript (mantener tal cual)

✅ **SÍ migrar**:
- Plantilla `workarea.html.twig` → Nunjucks
- 69 controladores API legacy `/api/*`
- OdeService.php (123K líneas) → múltiples servicios TypeScript
- Autenticación multi-método
- Exportadores (SCORM, HTML5, EPUB)
- Integración Electron

### Beneficios Esperados

- **Stack unificado**: JavaScript/TypeScript en toda la aplicación
- **Mejor integración Electron**: Node.js nativo en lugar de PHP embebido
- **Performance**: Node.js asíncrono para I/O
- **Mantenibilidad**: Un solo lenguaje para todo el equipo
- **WebSockets nativos**: Socket.io mejor que Mercure para Electron
- **Ecosistema NPM**: Librerías modernas de Node.js

---

## Arquitectura Real Actual

### Flujo de la Aplicación

```
1. Usuario abre eXeLearning (Electron)
   ↓
2. Electron lanza PHP runtime embebido
   ↓
3. Symfony arranca en localhost:RANDOM_PORT
   ↓
4. Electron abre ventana Chromium → http://localhost:PORT
   ↓
5. Usuario redirigido a /workarea
   ↓
6. WorkareaController (Symfony/PHP)
   ↓
7. Renderiza workarea.html.twig UNA VEZ
   ↓
8. HTML completo enviado al navegador:
   - Estructura de menús vacía
   - 19 modales pre-renderizados (ocultos)
   - Variables inyectadas en window.eXeLearning
   - 20+ scripts JavaScript cargados
   - TinyMCE, jQuery, Bootstrap
   ↓
9. JavaScript toma control (app.js)
   ↓
10. ApiCallManager carga endpoints desde API
   ↓
11. Managers inicializan:
    - LocaleManager (traducciones)
    - IdevicesManager (widgets educativos)
    - ThemesManager (estilos)
    - ProjectManager (carga proyecto vía API)
    - StructureManager (árbol navegación vía API)
    - UserManager (preferencias vía API)
   ↓
12. TODO lo demás es JavaScript + API REST
    - Edición con TinyMCE
    - Auto-guardado cada X segundos
    - Colaboración tiempo real (Mercure)
```

### Estructura de Archivos

```
exelearning/
├── main.js                          # Electron main process
├── package.json                     # Electron + linters
│
├── src/                             # Symfony backend
│   ├── Controller/
│   │   ├── net/exelearning/
│   │   │   ├── Controller/
│   │   │   │   ├── Workarea/
│   │   │   │   │   └── WorkareaController.php  ← CLAVE (render Twig)
│   │   │   │   ├── Api/                        ← 69 controladores API legacy
│   │   │   │   │   ├── OdeApiController.php
│   │   │   │   │   ├── IdeviceApiController.php
│   │   │   │   │   ├── ThemeApiController.php
│   │   │   │   │   ├── UserApiController.php
│   │   │   │   │   └── ... (65 más)
│   │   │   │   └── SecurityController.php
│   │   └── HealthCheckController.php
│   ├── Service/
│   │   └── net/exelearning/Service/
│   │       ├── Api/
│   │       │   └── OdeService.php              ← 123,777 líneas (CRÍTICO)
│   │       └── Export/
│   │           ├── ExportHTML5Service.php
│   │           ├── ExportSCORM12Service.php
│   │           ├── ExportEPUB3Service.php
│   │           └── ...
│   └── Entity/
│       └── net/exelearning/Entity/
│           ├── User.php
│           ├── OdeComponentsSync.php
│           ├── OdeNavStructureSync.php
│           └── ...
│
├── templates/
│   ├── base.html.twig
│   ├── security/
│   │   └── login.html.twig
│   └── workarea/
│       ├── workarea.html.twig           ← PLANTILLA PRINCIPAL
│       ├── menus/                       ← 4 partials
│       └── modals/                      ← 19 modales
│
├── public/
│   ├── app/                             # JavaScript frontend (9.6 MB)
│   │   ├── app.js                       # Bootstrap principal (708 líneas)
│   │   ├── rest/
│   │   │   └── apiCallManager.js        # Cliente API (1192 líneas)
│   │   ├── workarea/
│   │   │   ├── project/
│   │   │   │   ├── projectManager.js    # CORE
│   │   │   │   ├── structure/structureEngine.js
│   │   │   │   ├── idevices/idevicesEngine.js
│   │   │   │   └── properties/projectProperties.js
│   │   │   ├── menus/
│   │   │   ├── modals/
│   │   │   ├── themes/
│   │   │   └── user/
│   │   └── RealTimeEventNotifier/      # Mercure WebSockets
│   ├── libs/                            # jQuery, Bootstrap, TinyMCE
│   ├── style/                           # CSS
│   └── files/                           # Archivos de usuario
│
└── config/
    ├── routes.yaml
    ├── services.yaml
    └── packages/
```

### APIs Legacy a Migrar

**17 prefijos de rutas principales** (`/api/*`):

```
1.  /api/ode-management/odes                - Gestión proyectos ODE (CORE)
2.  /api/nav-structure-management           - Estructura de navegación
3.  /api/pag-structure-management           - Estructura de páginas
4.  /api/idevice-management/idevices        - Gestión de iDevices
5.  /api/theme-management/themes            - Gestión de temas
6.  /api/user-management/user               - Gestión de usuarios
7.  /api/translation-management             - Traducciones i18n
8.  /api/current-ode-users-management       - Usuarios activos (colaboración)
9.  /api/parameter-management               - Parámetros de configuración
10. /api/dropbox                            - Integración Dropbox
11. /api/google                             - Integración Google Drive
12. /api/ode-export                         - Exportación (SCORM, HTML5, EPUB)
13. /api/resource-lock                      - Bloqueos de recursos
14. /api/games                              - Juegos educativos
15. /api/ode-operations-management          - Log de operaciones
16. /api/platform-integration               - Integración con LMS
17. /api/filemanager                        - Gestor de archivos
```

**Total: 69 archivos PHP** a migrar a TypeScript/NestJS

---

## Análisis de Equivalencias

### Componentes Principales Symfony → NestJS

| Componente Symfony | Equivalente NestJS | Notas Específicas para eXeLearning |
|-------------------|-------------------|-----------------------------------|
| **Templates** |
| Twig | **Nunjucks** | **Recomendado**: sintaxis muy similar a Twig |
| | EJS | Alternativa: sintaxis tipo JSP |
| | Pug | Alternativa: sintaxis tipo Python |
| | ~~TSX~~ | ❌ NO compatible (es para React) |
| **Routing** |
| `#[Route('/workarea')]` | `@Get('workarea')` | Sintaxis muy similar |
| Route parameters | `@Param()`, `@Query()`, `@Body()` | Decoradores |
| **Base de Datos** |
| Doctrine ORM | TypeORM | Decoradores similares |
| Entities | `@Entity()` | Mismo patrón |
| Repositories | `@Repository()` | Built-in |
| **Autenticación** |
| SecurityBundle | `@nestjs/passport` | Passport strategies |
| MultiTokenHandler | Custom Strategy | Implementación manual |
| **Tiempo Real** |
| Mercure Bundle | `@nestjs/websockets` + Socket.io | **Mejor para Electron** |
| Server-Sent Events | Socket.io | Upgrade recomendado |
| **Servicios** |
| OdeService.php | Múltiples servicios TS | Dividir 123K líneas |
| ExportServices | Strategy Pattern | Mismo patrón |
| **Procesamiento Imágenes** |
| LiipImagineBundle | `sharp` | Librería Node.js nativa |
| **HTTP Client** |
| Symfony HTTP Client | `@nestjs/axios` | Axios |
| **Logging** |
| Monolog | `@nestjs/logger` o Winston | Múltiples opciones |
| **Validación** |
| Symfony Validator | `class-validator` | Decoradores similares |

### Dependencias NestJS Necesarias

```json
{
  "dependencies": {
    "@nestjs/core": "^10.0.0",
    "@nestjs/common": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "typeorm": "^0.3.20",
    "sqlite3": "^5.1.7",
    "mysql2": "^3.9.0",
    "pg": "^8.11.0",
    "nunjucks": "^3.2.4",
    "socket.io": "^4.6.0",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "passport-jwt": "^4.0.1",
    "bcrypt": "^5.1.1",
    "sharp": "^0.33.0",
    "archiver": "^6.0.0",
    "jszip": "^3.10.1",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1"
  }
}
```

---

## Arquitectura Objetivo NestJS

### Estructura de Directorios

```
exelearning/
├── main.js                          # Electron main (actualizar para NestJS)
├── package.json                     # Electron + NestJS + linters
│
├── backend/                         # NestJS backend (NUEVO)
│   ├── src/
│   │   ├── main.ts                  # Bootstrap NestJS
│   │   ├── app.module.ts            # Módulo raíz
│   │   │
│   │   ├── modules/
│   │   │   ├── workarea/            # Vista principal
│   │   │   │   ├── workarea.module.ts
│   │   │   │   ├── workarea.controller.ts
│   │   │   │   └── workarea.service.ts
│   │   │   │
│   │   │   ├── ode/                 # ODE Management API
│   │   │   │   ├── ode.module.ts
│   │   │   │   ├── ode.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── ode-orchestrator.service.ts
│   │   │   │   │   ├── ode-components.service.ts
│   │   │   │   │   ├── ode-navigation.service.ts
│   │   │   │   │   ├── ode-structure.service.ts
│   │   │   │   │   ├── ode-properties.service.ts
│   │   │   │   │   └── ode-operations.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── nav-structure/       # Navegación
│   │   │   │   ├── nav-structure.module.ts
│   │   │   │   ├── nav-structure.controller.ts
│   │   │   │   └── nav-structure.service.ts
│   │   │   │
│   │   │   ├── pag-structure/       # Páginas
│   │   │   │   ├── pag-structure.module.ts
│   │   │   │   ├── pag-structure.controller.ts
│   │   │   │   └── pag-structure.service.ts
│   │   │   │
│   │   │   ├── idevices/            # iDevices
│   │   │   ├── themes/              # Temas
│   │   │   ├── users/               # Usuarios
│   │   │   ├── translation/         # Traducciones
│   │   │   ├── current-ode-users/   # Colaboración
│   │   │   ├── parameters/          # Configuración
│   │   │   ├── export/              # Exportación
│   │   │   ├── filemanager/         # Gestor archivos
│   │   │   ├── storage/             # Dropbox, Google Drive
│   │   │   ├── games/               # Juegos educativos
│   │   │   ├── resource-lock/       # Locks
│   │   │   ├── platform/            # LMS integration
│   │   │   ├── auth/                # Autenticación
│   │   │   └── realtime/            # WebSockets
│   │   │
│   │   ├── database/
│   │   │   ├── entities/
│   │   │   │   ├── user.entity.ts
│   │   │   │   ├── ode-components-sync.entity.ts
│   │   │   │   ├── ode-nav-structure-sync.entity.ts
│   │   │   │   └── ...
│   │   │   └── migrations/
│   │   │
│   │   └── common/
│   │       ├── guards/
│   │       ├── interceptors/
│   │       └── filters/
│   │
│   ├── views/                       # Plantillas Nunjucks
│   │   ├── base.njk
│   │   ├── security/
│   │   │   └── login.njk
│   │   └── workarea/
│   │       ├── workarea.njk         # Migrado de Twig
│   │       ├── menus/
│   │       └── modals/
│   │
│   ├── test/
│   ├── tsconfig.json
│   └── package.json
│
├── public/                          # Frontend (SIN CAMBIOS)
│   ├── app/                         # JavaScript vanilla (mantener)
│   ├── libs/
│   ├── style/
│   └── files/
│
└── config/
```

### Módulos NestJS

```
AppModule (root)
├── ConfigModule (global)
├── DatabaseModule (TypeORM)
├── WorkareaModule              ← Render de plantilla principal
├── AuthModule                  ← Login/logout
├── OdeModule                   ← CORE (gestión proyectos ODE)
│   ├── OdeOrchestratorService
│   ├── OdeComponentsService
│   ├── OdeNavigationService
│   ├── OdeStructureService
│   ├── OdePropertiesService
│   └── OdeOperationsService
├── NavStructureModule          ← Navegación
├── PagStructureModule          ← Páginas
├── IDevicesModule              ← iDevices
├── ThemesModule                ← Temas
├── UsersModule                 ← Usuarios
├── TranslationModule           ← i18n
├── CurrentOdeUsersModule       ← Colaboración
├── ParametersModule            ← Configuración
├── ExportModule                ← Exportación (SCORM, HTML5, EPUB)
├── FilemanagerModule           ← Gestor archivos
├── StorageModule               ← Dropbox, Google Drive
│   ├── DropboxService
│   └── GoogleDriveService
├── GamesModule                 ← Juegos educativos
├── ResourceLockModule          ← Locks
├── PlatformModule              ← LMS integration
└── RealtimeModule              ← WebSockets (Socket.io)
```

---

## Plan de Migración por Fases

### Estrategia: Coexistencia Durante Desarrollo

Durante la migración:
- **NO coexistencia en producción** (es aplicación Electron de escritorio)
- **Desarrollo en paralelo**: mantener Symfony funcionando mientras se desarrolla NestJS
- **Testing exhaustivo** antes de switchover
- **Release única**: cuando NestJS esté 100% listo

---

### Fase 0: Preparación y Setup (1-2 semanas)

#### Objetivos
- Inicializar proyecto NestJS
- Configurar TypeORM con BD existente
- Setup Nunjucks para plantillas
- Configurar entorno de desarrollo

#### Tareas

**1. Inicializar Proyecto NestJS**
```bash
cd exelearning
mkdir backend
cd backend
npm init -y
npm install @nestjs/cli
nest new . --skip-git
```

**2. Configurar TypeScript**
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**3. Instalar Dependencias**
```bash
npm install @nestjs/typeorm typeorm sqlite3 mysql2 pg
npm install @nestjs/passport passport passport-local passport-jwt
npm install @nestjs/jwt bcrypt
npm install @nestjs/config
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install nunjucks @types/nunjucks
npm install sharp archiver jszip
npm install class-validator class-transformer
```

**4. Configurar TypeORM**
```typescript
// src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: process.env.DB_DRIVER as any || 'sqlite',
  database: process.env.DB_PATH || '../data/exelearning.db',
  entities: [__dirname + '/../database/entities/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false, // NUNCA true
  logging: process.env.NODE_ENV === 'development',
};
```

**5. Configurar Nunjucks**
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as nunjucks from 'nunjucks';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configurar Nunjucks
  const viewsPath = join(__dirname, '..', 'views');
  nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app.getHttpAdapter().getInstance(),
  });
  app.setViewEngine('njk');

  // Servir archivos estáticos
  app.useStaticAssets(join(__dirname, '..', '..', 'public'));

  await app.listen(3000);
}
bootstrap();
```

**6. Setup Testing**
```bash
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev supertest @types/supertest
```

#### Entregables
- ✅ Proyecto NestJS inicializado
- ✅ TypeORM configurado
- ✅ Nunjucks configurado
- ✅ Dependencias instaladas
- ✅ Tests básicos funcionando

---

### Fase 1: Migración de Vista Principal (1-2 semanas)

#### Objetivos
- Migrar `workarea.html.twig` → `workarea.njk`
- Implementar `WorkareaController` en NestJS
- Validar render de HTML idéntico

#### Tareas

**1.1 Crear WorkareaModule**
```typescript
// src/modules/workarea/workarea.module.ts
import { Module } from '@nestjs/common';
import { WorkareaController } from './workarea.controller';
import { WorkareaService } from './workarea.service';

@Module({
  controllers: [WorkareaController],
  providers: [WorkareaService],
})
export class WorkareaModule {}
```

**1.2 Migrar Plantilla Twig → Nunjucks**

**Antes (Twig):**
```twig
{# templates/workarea/workarea.html.twig #}
{% extends 'base.html.twig' %}

{% block javascripts %}
    <script class="exe">
        window.eXeLearning = {
            version: "{{ constant('App\\Constants::APP_VERSION') }}",
            user: {{ user | json_encode | raw }},
            config: {{ config | json_encode | raw }},
            symfony: {{ symfony | json_encode | raw }},
            mercure: {{ mercure | json_encode | raw }}
        }
    </script>
{% endblock %}

{% block body %}
    <div id="exe-workarea">
        {% include 'workarea/menus/main-menu.html.twig' %}
        <!-- ... -->
    </div>
{% endblock %}
```

**Después (Nunjucks):**
```nunjucks
{# views/workarea/workarea.njk #}
{% extends "base.njk" %}

{% block javascripts %}
    <script class="exe">
        window.eXeLearning = {
            version: "{{ appVersion }}",
            user: {{ user | dump | safe }},
            config: {{ config | dump | safe }},
            symfony: {{ symfony | dump | safe }},
            websocket: {{ websocket | dump | safe }}
        }
    </script>
{% endblock %}

{% block body %}
    <div id="exe-workarea">
        {% include "workarea/menus/main-menu.njk" %}
        <!-- ... -->
    </div>
{% endblock %}
```

**Diferencias Twig → Nunjucks:**
| Twig | Nunjucks | Notas |
|------|----------|-------|
| `{{ var \| json_encode \| raw }}` | `{{ var \| dump \| safe }}` | Serialización JSON |
| `{% include 'file.html.twig' %}` | `{% include "file.njk" %}` | Comillas dobles |
| `{% extends 'base.html.twig' %}` | `{% extends "base.njk" %}` | Comillas dobles |
| `constant('Class::CONST')` | `{{ constant }}` | Pasar como variable |
| Funciones PHP | Filtros Nunjucks | Implementar custom filters |

**1.3 Implementar WorkareaController**
```typescript
// src/modules/workarea/workarea.controller.ts
import { Controller, Get, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { WorkareaService } from './workarea.service';

@Controller()
export class WorkareaController {
  constructor(private workareaService: WorkareaService) {}

  @Get('/')
  redirectToWorkarea() {
    return { url: '/workarea' };
  }

  @Get('workarea')
  @Render('workarea/workarea')
  async renderWorkarea(@Req() req: Request) {
    const user = req.user; // De autenticación

    return {
      appVersion: process.env.APP_VERSION,
      user: user,
      config: await this.workareaService.getConfig(),
      symfony: {}, // Compatibilidad legacy
      websocket: {
        url: process.env.WEBSOCKET_URL,
        port: process.env.WEBSOCKET_PORT,
      },
    };
  }
}
```

**1.4 Testing**
- Comparar HTML renderizado: Symfony vs NestJS
- Validar que JavaScript frontend funciona igual
- Validar que todas las variables están disponibles

#### Criterios de Éxito
- ✅ HTML renderizado idéntico
- ✅ JavaScript frontend funciona sin cambios
- ✅ Todas las variables inyectadas correctamente

---

### Fase 2: Autenticación (2 semanas)

#### Objetivos
- Implementar login/logout
- Migrar MultiTokenHandler
- Soporte para CAS, OIDC, JWT, API Keys

#### Tareas

**2.1 Entidad User**
```typescript
// src/database/entities/user.entity.ts
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

  @Column({ type: 'varchar', nullable: true, name: 'user_id' })
  userId: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'external_identifier' })
  externalIdentifier: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'api_token' })
  apiToken: string | null;

  @Column({ type: 'integer', nullable: true, name: 'quota_mb' })
  quotaMb: number | null;
}
```

**2.2 AuthModule**
```typescript
// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CasStrategy } from './strategies/cas.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { ApiKeyStrategy } from './strategies/api-key.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    CasStrategy,
    OidcStrategy,
    ApiKeyStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

**2.3 Multi-Token Strategy**
```typescript
// src/modules/auth/strategies/multi-token.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';

@Injectable()
export class MultiTokenStrategy extends PassportStrategy(Strategy, 'multi-token') {
  async validate(req: any): Promise<any> {
    // 1. Check CAS ticket
    const ticket = req.query.ticket;
    if (ticket && (ticket.startsWith('ST-') || ticket.startsWith('PT-'))) {
      return this.validateCasTicket(ticket);
    }

    // 2. Check JWT Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return this.validateJwtToken(token);
    }

    // 3. Check OIDC token
    // ...

    // 4. Check API Key
    const apiKey = req.query.access_token || req.headers['x-api-key'];
    if (apiKey) {
      return this.validateApiKey(apiKey);
    }

    throw new UnauthorizedException();
  }
}
```

#### Endpoints a Migrar
```
POST   /login
POST   /logout
GET    /api/session/check
```

---

### Fase 3: API ODE Core (4-5 semanas) ⭐ CRÍTICO

#### Objetivos
- Migrar OdeService.php (123,777 líneas)
- Dividir en servicios especializados
- Implementar todos los endpoints `/api/ode-management/*`

#### Estrategia de División

**Antes:**
```
OdeService.php (123,777 líneas)
```

**Después:**
```
ode/
├── ode-orchestrator.service.ts        (500 líneas)
├── services/
│   ├── ode-components.service.ts      (5,000 líneas)
│   ├── ode-navigation.service.ts      (8,000 líneas)
│   ├── ode-page-structure.service.ts  (8,000 líneas)
│   ├── ode-properties.service.ts      (5,000 líneas)
│   ├── ode-operations.service.ts      (10,000 líneas)
│   ├── ode-sync.service.ts            (15,000 líneas)
│   ├── ode-files.service.ts           (8,000 líneas)
│   └── ode-current-users.service.ts   (5,000 líneas)
```

#### Tareas

**3.1 Análisis de OdeService.php**
- Identificar métodos públicos (API)
- Agrupar por responsabilidad
- Detectar dependencias entre métodos
- Crear mapa de migración

**3.2 Crear OdeModule**
```typescript
// src/modules/ode/ode.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OdeController } from './ode.controller';
import { OdeOrchestratorService } from './ode-orchestrator.service';
import { OdeComponentsService } from './services/ode-components.service';
// ... importar todos los servicios

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OdeComponentsSync,
      OdeNavStructureSync,
      // ... todas las entidades
    ]),
  ],
  controllers: [OdeController],
  providers: [
    OdeOrchestratorService,
    OdeComponentsService,
    OdeNavigationService,
    // ... todos los servicios
  ],
  exports: [OdeOrchestratorService],
})
export class OdeModule {}
```

**3.3 Migrar Endpoints**
```typescript
// src/modules/ode/ode.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';

@Controller('api/ode-management')
export class OdeController {
  constructor(
    private odeOrchestrator: OdeOrchestratorService,
  ) {}

  @Get('odes')
  async listOdes() {
    return this.odeOrchestrator.listOdes();
  }

  @Post('odes')
  async createOde(@Body() dto: CreateOdeDto) {
    return this.odeOrchestrator.createOde(dto);
  }

  @Get('odes/:id')
  async getOde(@Param('id') id: string) {
    return this.odeOrchestrator.getOde(id);
  }

  @Put('odes/:id')
  async updateOde(@Param('id') id: string, @Body() dto: UpdateOdeDto) {
    return this.odeOrchestrator.updateOde(id, dto);
  }

  @Delete('odes/:id')
  async deleteOde(@Param('id') id: string) {
    return this.odeOrchestrator.deleteOde(id);
  }

  // ... más endpoints
}
```

**3.4 Testing**
- Tests unitarios de cada servicio
- Tests de integración
- Tests E2E de flujos completos
- Comparar respuestas JSON con Symfony

#### Plan Detallado (14 semanas)
| Semana | Tarea |
|--------|-------|
| 1-2 | Análisis de OdeService.php |
| 3-4 | Migrar ode-orchestrator + ode-components |
| 5-6 | Migrar ode-navigation + ode-structure |
| 7-8 | Migrar ode-properties + ode-operations |
| 9-10 | Migrar ode-sync + ode-files |
| 11-12 | Migrar ode-current-users |
| 13-14 | Testing integración completa |

---

### Fase 4: APIs Secundarias (4-6 semanas)

#### Objetivos
- Migrar 16 prefijos de API restantes
- Implementar todos los controladores

#### Módulos a Migrar

**4.1 NavStructureModule** (1 semana)
```
/api/nav-structure-management/*
```

**4.2 PagStructureModule** (1 semana)
```
/api/pag-structure-management/*
```

**4.3 IDevicesModule** (1 semana)
```
/api/idevice-management/idevices/*
```

**4.4 ThemesModule** (1 semana)
```
/api/theme-management/themes/*
```

**4.5 UsersModule** (1 semana)
```
/api/user-management/user/*
```

**4.6 TranslationModule** (1 semana)
```
/api/translation-management/*
```

**4.7 CurrentOdeUsersModule** (1 semana)
```
/api/current-ode-users-management/*
```

**4.8 ParametersModule** (1 semana)
```
/api/parameter-management/*
```

**4.9 FilemanagerModule** (1 semana)
```
/api/filemanager/*
```

**4.10 GamesModule** (1 semana)
```
/api/games/*
```

**4.11 ResourceLockModule** (1 semana)
```
/api/resource-lock/*
```

**4.12 PlatformModule** (1 semana)
```
/api/platform-integration/*
```

#### Ejemplo: IDevicesModule

```typescript
// src/modules/idevices/idevices.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';

@Controller('api/idevice-management')
export class IDevicesController {
  constructor(private idevicesService: IDevicesService) {}

  @Get('idevices')
  async listIDevices() {
    return this.idevicesService.findAll();
  }

  @Get('idevices/:id')
  async getIDevice(@Param('id') id: string) {
    return this.idevicesService.findOne(id);
  }

  @Post('idevices')
  async createIDevice(@Body() dto: CreateIDeviceDto) {
    return this.idevicesService.create(dto);
  }

  // ... más endpoints
}
```

---

### Fase 5: Exportación (3-4 semanas)

#### Objetivos
- Migrar exportadores: HTML5, SCORM 1.2, SCORM 2004, EPUB3, IMS
- Mantener compatibilidad de formatos

#### Tareas

**5.1 Strategy Pattern**
```typescript
// src/modules/export/interfaces/export-strategy.interface.ts
export interface ExportStrategy {
  export(project: any, options: ExportOptions): Promise<Buffer>;
  getFormat(): string;
  getMimeType(): string;
}
```

**5.2 Implementar Exportadores**
```typescript
// src/modules/export/strategies/scorm12.export.ts
import { Injectable } from '@nestjs/common';
import * as JSZip from 'jszip';

@Injectable()
export class Scorm12ExportStrategy implements ExportStrategy {
  async export(project: any, options: ExportOptions): Promise<Buffer> {
    // 1. Generate imsmanifest.xml
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

  private generateManifest(project: any): string {
    // Generar XML SCORM 1.2
  }

  private async convertToScos(pages: any[]): Promise<any[]> {
    // Convertir páginas a SCOs
  }
}
```

**5.3 ExportController**
```typescript
// src/modules/export/export.controller.ts
import { Controller, Get, Post, Param, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('api/ode-export')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get(':format/:projectId')
  async exportProject(
    @Param('format') format: string,
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.export(format, projectId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="project.zip"`);
    res.send(buffer);
  }
}
```

#### Formatos a Implementar
- HTML5
- HTML5 Single Page
- SCORM 1.2
- SCORM 2004
- EPUB3
- IMS Content Package

---

### Fase 6: Almacenamiento Cloud (2-3 semanas)

#### Objetivos
- Migrar integración Google Drive
- Migrar integración Dropbox

#### Tareas

**6.1 Google Drive**
```typescript
// src/modules/storage/google-drive/google-drive.service.ts
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';

@Injectable()
export class GoogleDriveService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
    });
  }

  async getToken(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  async uploadFile(fileBuffer: Buffer, filename: string): Promise<any> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    // ... upload logic
  }
}
```

**6.2 Dropbox**
```typescript
// src/modules/storage/dropbox/dropbox.service.ts
import { Injectable } from '@nestjs/common';
import { Dropbox } from 'dropbox';

@Injectable()
export class DropboxService {
  private dbx: Dropbox;

  constructor() {
    this.dbx = new Dropbox({
      clientId: process.env.DROPBOX_CLIENT_ID,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET,
    });
  }

  // ... methods
}
```

---

### Fase 7: WebSockets / Tiempo Real (2-3 semanas)

#### Objetivos
- Reemplazar Mercure con Socket.io
- Implementar colaboración en tiempo real

#### Tareas

**7.1 RealtimeModule**
```typescript
// src/modules/realtime/realtime.module.ts
import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Module({
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
```

**7.2 RealtimeGateway**
```typescript
// src/modules/realtime/realtime.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-project')
  handleJoinProject(client: Socket, projectId: string) {
    client.join(`project-${projectId}`);
    this.server.to(`project-${projectId}`).emit('user-joined', {
      userId: client.id,
    });
  }

  @SubscribeMessage('project-update')
  handleProjectUpdate(client: Socket, data: any) {
    client.to(`project-${data.projectId}`).emit('project-updated', data);
  }

  @SubscribeMessage('page-update')
  handlePageUpdate(client: Socket, data: any) {
    client.to(`project-${data.projectId}`).emit('page-updated', data);
  }
}
```

**7.3 Actualizar Frontend JavaScript**
```javascript
// public/app/RealTimeEventNotifier/RealTimeEventNotifier.js
// Reemplazar Mercure por Socket.io

class RealTimeEventNotifier {
  constructor(app) {
    this.app = app;
    this.socket = io(window.eXeLearning.websocket.url);

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      if (this.app.project.currentProjectId) {
        this.socket.emit('join-project', this.app.project.currentProjectId);
      }
    });

    this.socket.on('project-updated', (data) => {
      this.app.project.handleRemoteUpdate(data);
    });

    this.socket.on('page-updated', (data) => {
      this.app.project.structure.handleRemotePageUpdate(data);
    });
  }

  notifyProjectUpdate(data) {
    this.socket.emit('project-update', {
      projectId: this.app.project.currentProjectId,
      ...data,
    });
  }

  notifyPageUpdate(data) {
    this.socket.emit('page-update', {
      projectId: this.app.project.currentProjectId,
      ...data,
    });
  }
}
```

---

### Fase 8: Testing & Optimización (2-3 semanas)

#### Objetivos
- Testing exhaustivo E2E
- Performance testing
- Security audit

#### Tareas

**8.1 Tests E2E**
```typescript
// test/e2e/ode.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ODE API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/ode-management/odes (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/ode-management/odes')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  // ... más tests
});
```

**8.2 Performance Testing**
- Usar Artillery o k6
- Comparar con Symfony
- Optimizar queries lentas

**8.3 Security Audit**
- `npm audit`
- Helmet.js
- Rate limiting
- CORS
- Validación de entrada

---

### Fase 9: Integración Electron (1-2 semanas)

#### Objetivos
- Actualizar `main.js` para lanzar NestJS
- Reemplazar PHP runtime por Node.js

#### Tareas

**9.1 Actualizar main.js**
```javascript
// main.js (Electron main process)
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let nestProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Esperar a que NestJS esté listo
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 3000);
}

function startNestJS() {
  // Lanzar servidor NestJS
  nestProcess = spawn('node', ['backend/dist/main.js'], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  nestProcess.on('error', (err) => {
    console.error('Failed to start NestJS:', err);
  });
}

app.whenReady().then(() => {
  startNestJS();
  createWindow();
});

app.on('window-all-closed', () => {
  if (nestProcess) {
    nestProcess.kill();
  }
  app.quit();
});
```

**9.2 Actualizar package.json**
```json
{
  "name": "exelearning",
  "version": "3.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build:backend": "cd backend && npm run build",
    "build": "npm run build:backend && electron-builder"
  },
  "dependencies": {
    "electron": "^39.0.0"
  }
}
```

**9.3 Empaquetar Node.js**
- Incluir Node.js runtime en el bundle
- Configurar electron-builder para incluir `backend/dist`

---

### Fase 10: Release & Deployment (1-2 semanas)

#### Objetivos
- Preparar release final
- Testing con usuarios beta
- Documentación

#### Tareas

**10.1 Build Final**
```bash
cd backend
npm run build
cd ..
npm run build
```

**10.2 Testing**
- Instalación en Windows, Mac, Linux
- Validar migración de datos
- Performance en producción

**10.3 Documentación**
- Guía de migración para usuarios
- Changelog detallado
- Troubleshooting

**10.4 Release**
- Crear release en GitHub
- Distribuir binarios
- Comunicar a usuarios

---

## Migración de Plantillas Twig

### Comparativa Twig vs Nunjucks

| Característica | Twig (Symfony) | Nunjucks (NestJS) |
|---------------|----------------|-------------------|
| **Herencia** | `{% extends 'base.html.twig' %}` | `{% extends "base.njk" %}` |
| **Bloques** | `{% block title %}` | `{% block title %}` ✅ Igual |
| **Include** | `{% include 'partial.twig' %}` | `{% include "partial.njk" %}` |
| **Variables** | `{{ variable }}` | `{{ variable }}` ✅ Igual |
| **Filtros** | `{{ var \| upper }}` | `{{ var \| upper }}` ✅ Igual |
| **JSON** | `{{ var \| json_encode \| raw }}` | `{{ var \| dump \| safe }}` |
| **Condicionales** | `{% if condition %}` | `{% if condition %}` ✅ Igual |
| **Loops** | `{% for item in items %}` | `{% for item in items %}` ✅ Igual |
| **Comentarios** | `{# comment #}` | `{# comment #}` ✅ Igual |
| **Constantes PHP** | `constant('Class::CONST')` | ❌ Pasar como variable |
| **Funciones** | Funciones Twig | Filtros/funciones custom |

### Filtros Personalizados Nunjucks

```typescript
// src/config/nunjucks-filters.ts
import * as nunjucks from 'nunjucks';

export function configureNunjucksFilters(env: nunjucks.Environment) {
  // Filtro para JSON (equivalente a json_encode | raw)
  env.addFilter('dump', (obj) => {
    return JSON.stringify(obj, null, 2);
  });

  // Filtro para fechas
  env.addFilter('date', (date, format) => {
    // Usar librería de fechas (date-fns, dayjs)
    return formatDate(date, format);
  });

  // Más filtros personalizados...
}
```

### Ejemplo Completo: workarea.njk

```nunjucks
{# views/workarea/workarea.njk #}
{% extends "base.njk" %}

{% block title %}eXeLearning - Workarea{% endblock %}

{% block stylesheets %}
    {{ super() }}
    <link rel="stylesheet" href="/style/workarea/main.css">
    <link rel="stylesheet" href="/libs/bootstrap/bootstrap.min.css">
{% endblock %}

{% block javascripts %}
    {{ super() }}

    {# Inyectar configuración global #}
    <script class="exe">
        window.eXeLearning = {
            version: "{{ appVersion }}",
            user: {{ user | dump | safe }},
            config: {{ config | dump | safe }},
            websocket: {
                url: "{{ websocket.url }}",
                port: {{ websocket.port }}
            }
        };
    </script>

    {# Librerías de terceros #}
    <script src="/libs/jquery/jquery-3.7.1.min.js"></script>
    <script src="/libs/bootstrap/bootstrap.bundle.min.js"></script>
    <script src="/libs/tinymce_5/tinymce.min.js"></script>

    {# Aplicación JavaScript #}
    <script type="module" src="/app/app.js"></script>
{% endblock %}

{% block body %}
    <div id="exe-workarea" class="exe-container">
        {# Header #}
        <header class="exe-header">
            {% include "workarea/menus/main-menu.njk" %}
        </header>

        {# Main content #}
        <main class="exe-main">
            <div id="exe-project-container">
                {# JavaScript llenará esto dinámicamente #}
            </div>
        </main>

        {# Modales (pre-renderizados, ocultos) #}
        {% include "workarea/modals/generic/modal-confirm.njk" %}
        {% include "workarea/modals/generic/modal-alert.njk" %}
        {% include "workarea/modals/pages/modal-add-page.njk" %}
        {% include "workarea/modals/pages/modal-edit-page.njk" %}
        {# ... 15 modales más #}

        {# Toasts #}
        {% include "workarea/toast/toast-container.njk" %}
    </div>
{% endblock %}
```

---

## Integración con Electron

### Arquitectura Electron + NestJS

```
┌─────────────────────────────────────────┐
│         Electron Main Process           │
│                (main.js)                │
│                                         │
│  1. Lanza servidor NestJS (child proc) │
│  2. Crea ventana Chromium              │
│  3. Carga http://localhost:3000        │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│  NestJS      │      │  Electron        │
│  Backend     │      │  Renderer        │
│  (Node.js)   │◄─────┤  (Chromium)      │
│              │ HTTP │                  │
│  Port 3000   │      │  JavaScript app  │
└──────────────┘      └──────────────────┘
        │
        ▼
┌──────────────┐
│  SQLite DB   │
│  (local)     │
└──────────────┘
```

### main.js Mejorado

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');

let mainWindow = null;
let nestProcess = null;
const NEST_PORT = 3000;

function startNestJS() {
  return new Promise((resolve, reject) => {
    console.log('Starting NestJS server...');

    // Lanzar NestJS
    nestProcess = spawn('node', [
      path.join(__dirname, 'backend', 'dist', 'main.js')
    ], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: NEST_PORT,
        DB_PATH: path.join(app.getPath('userData'), 'exelearning.db'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    nestProcess.stdout.on('data', (data) => {
      console.log(`NestJS: ${data}`);
    });

    nestProcess.stderr.on('data', (data) => {
      console.error(`NestJS ERROR: ${data}`);
    });

    nestProcess.on('error', (err) => {
      console.error('Failed to start NestJS:', err);
      reject(err);
    });

    // Esperar a que NestJS esté listo
    waitOn({
      resources: [`http://localhost:${NEST_PORT}/healthcheck`],
      timeout: 30000,
    })
      .then(() => {
        console.log('NestJS server ready!');
        resolve();
      })
      .catch((err) => {
        console.error('NestJS failed to start:', err);
        reject(err);
      });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // No mostrar hasta que esté listo
  });

  mainWindow.loadURL(`http://localhost:${NEST_PORT}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // DevTools en desarrollo
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  try {
    await startNestJS();
    createWindow();
  } catch (err) {
    console.error('Startup failed:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Matar NestJS
  if (nestProcess) {
    nestProcess.kill('SIGTERM');
  }
  app.quit();
});

app.on('will-quit', () => {
  // Asegurar que NestJS se cierra
  if (nestProcess) {
    nestProcess.kill('SIGKILL');
  }
});

// IPC para comunicación Renderer ↔ Main
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});
```

### Package & Build

```json
// package.json
{
  "name": "exelearning",
  "version": "3.0.0",
  "description": "eXeLearning authoring tool",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "start:dev": "NODE_ENV=development electron .",
    "build:backend": "cd backend && npm run build",
    "build": "npm run build:backend && electron-builder",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.exelearning.app",
    "productName": "eXeLearning",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "backend/dist/**/*",
      "public/**/*",
      "!backend/node_modules",
      "!backend/src"
    ],
    "extraResources": [
      {
        "from": "backend/node_modules",
        "to": "backend/node_modules",
        "filter": ["**/*"]
      }
    ],
    "win": {
      "target": "nsis",
      "icon": "public/icons/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "public/icons/icon.icns"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "icon": "public/icons/"
    }
  },
  "dependencies": {
    "electron": "^39.0.0",
    "wait-on": "^7.2.0"
  },
  "devDependencies": {
    "electron-builder": "^26.0.12"
  }
}
```

---

## Riesgos y Mitigaciones

### Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **OdeService migración compleja** | Alta | Crítico | Dividir en servicios pequeños, tests exhaustivos, migración gradual |
| **Incompatibilidad Twig→Nunjucks** | Media | Alto | Comparar HTML renderizado, tests visuales, mantener misma estructura |
| **Performance degradation** | Media | Alto | Profiling continuo, optimización de queries, benchmarking |
| **Bugs en API REST** | Alta | Alto | Tests E2E completos, comparar respuestas JSON con Symfony |
| **Electron + NestJS integración** | Media | Alto | PoC temprano, testing en múltiples plataformas |
| **WebSockets (Mercure→Socket.io)** | Baja | Medio | Tests de concurrencia, validar colaboración tiempo real |
| **Exportadores incompatibles** | Media | Crítico | Tests con archivos reales, validación de formatos |
| **Base de datos corrupción** | Baja | Crítico | Backups automáticos, mismo schema, validación de datos |

### Riesgos de Proyecto

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Timeline sobrepasado** | Alta | Medio | Buffer en planning (25%), priorización, MVP primero |
| **Falta de experiencia NestJS** | Media | Medio | Training del equipo, documentación, pair programming |
| **Resistencia al cambio** | Baja | Bajo | Es migración interna, usuarios no ven diferencia |
| **Coste excesivo** | Media | Medio | Sprints cortos, revisión continua de progreso |

### Plan de Contingencia

**Si la migración toma más tiempo:**
1. Priorizar funcionalidad core (ODE, exportación)
2. Lanzar versión beta para testing
3. Agregar features secundarias después

**Si hay bugs críticos:**
1. Mantener versión Symfony disponible
2. Hotfix inmediato
3. Post-mortem y documentación

---

## Timeline Estimado

### Resumen por Fases

| Fase | Duración | Semanas Acumuladas |
|------|----------|-------------------|
| 0. Preparación | 1-2 semanas | 2 |
| 1. Vista Principal | 1-2 semanas | 4 |
| 2. Autenticación | 2 semanas | 6 |
| 3. API ODE Core | 4-5 semanas | 11 |
| 4. APIs Secundarias | 4-6 semanas | 17 |
| 5. Exportación | 3-4 semanas | 21 |
| 6. Storage Cloud | 2-3 semanas | 24 |
| 7. WebSockets | 2-3 semanas | 27 |
| 8. Testing | 2-3 semanas | 30 |
| 9. Electron | 1-2 semanas | 32 |
| 10. Release | 1-2 semanas | 34 |

**Total: 23-38 semanas (5-9 meses)**

### Timeline Visual

```
Mes 1  ████ Prep + Vista + Auth (inicio)
Mes 2  ████ Auth (fin) + ODE (inicio)
Mes 3  ████ ODE Core
Mes 4  ████ ODE (fin) + APIs Secundarias (inicio)
Mes 5  ████ APIs Secundarias
Mes 6  ████ Exportación + Storage
Mes 7  ████ WebSockets + Testing (inicio)
Mes 8  ████ Testing + Electron
Mes 9  ████ Release + Estabilización
```

### Hitos Críticos

- **Mes 1**: Vista principal funciona ✓
- **Mes 2**: Login/logout funciona ✓
- **Mes 4**: ODE Service migrado ✓ (HITO MÁS IMPORTANTE)
- **Mes 6**: Exportación funciona ✓
- **Mes 7**: WebSockets funciona ✓
- **Mes 8**: Electron integrado ✓
- **Mes 9**: Release final ✓

---

## Recursos Necesarios

### Equipo Recomendado

**Mínimo (4 personas):**
1. **Tech Lead** (1) - Arquitectura, decisiones técnicas, code reviews
2. **Backend Developers** (2) - Migración de servicios, APIs, testing
3. **QA Engineer** (1) - Testing, validación, documentación

**Óptimo (6 personas):**
1. **Tech Lead** (1)
2. **Senior Backend Dev** (1) - ODE Service migration
3. **Backend Developers** (2) - APIs secundarias
4. **Frontend Dev** (1) - Adaptaciones JavaScript, WebSockets
5. **QA Engineer** (1)

### Tecnologías

**Backend:**
- NestJS 10+
- TypeORM 0.3+
- Nunjucks 3+
- Socket.io 4+
- Sharp, JSZip, Archiver

**Frontend:**
- Sin cambios (JavaScript vanilla)
- Actualizar solo WebSockets

**Desktop:**
- Electron 39+
- Electron Builder

**Testing:**
- Jest
- Supertest
- Artillery (load testing)

### Infraestructura

**Desarrollo:**
- Git repository
- CI/CD (GitHub Actions)
- Code coverage (Codecov)

**Testing:**
- Entorno de staging
- Múltiples plataformas (Win, Mac, Linux)

---

## Conclusión

La migración de eXeLearning de Symfony a NestJS es **VIABLE y SIMPLIFICADA** gracias a la arquitectura real descubierta:

### Ventajas Clave

✅ **Solo 1 plantilla Twig** a migrar (workarea.njk)
✅ **Frontend NO cambia** (JavaScript vanilla funciona igual)
✅ **APIs bien definidas** (69 controladores)
✅ **Electron + Node.js** (mejor que Electron + PHP)
✅ **WebSockets nativos** (Socket.io mejor que Mercure)
✅ **Stack unificado** (JavaScript/TypeScript everywhere)

### Desafíos Principales

⚠️ **OdeService.php** (123K líneas) - requiere división cuidadosa
⚠️ **69 controladores API** - muchos endpoints a migrar
⚠️ **Exportadores** - formatos complejos (SCORM, EPUB)
⚠️ **Testing exhaustivo** - validar TODAS las funcionalidades

### Recomendación Final

**PROCEDER con la migración** siguiendo este plan:

1. **Fase 0-1** (3-4 semanas): Setup + Vista principal
2. **Validar**: Comprobar que la arquitectura funciona
3. **Fase 2-3** (6-7 semanas): Auth + ODE Core (CRÍTICO)
4. **Validar**: Testing intensivo del core
5. **Fases 4-7** (11-15 semanas): APIs secundarias + Features
6. **Fases 8-10** (4-6 semanas): Testing + Electron + Release

**Timeline realista: 6-8 meses** con equipo de 4-6 personas.

---

**Documento creado**: 2025-11-15
**Versión**: 2.0 (Actualizado con arquitectura real)
**Estado**: Plan Final
**Próximos pasos**:
1. Aprobación del plan
2. Formación del equipo
3. Inicio Fase 0 (Setup NestJS)

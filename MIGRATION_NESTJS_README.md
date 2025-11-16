# Migración eXeLearning: Symfony → NestJS (Strangler Fig Pattern)

## Estado Actual

### ✅ Completado
- Estructura inicial de NestJS creada
- Configuración de TypeORM
- Configuración de Nunjucks para plantillas
- Proxy server para patrón Strangler Fig
- Módulos básicos: Health, Workarea, Auth, Project
- Scripts de desarrollo

### 🚧 En Progreso
- Migración de endpoints uno por uno
- Integración con BD existente

### 📋 Pendiente
- Migración completa de OdeService
- Migración de todas las APIs legacy
- WebSockets (Socket.io)
- Exportadores (SCORM, HTML5, EPUB)

## Arquitectura Strangler Fig

El patrón Strangler Fig permite migrar gradualmente de Symfony a NestJS sin interrumpir el servicio:

```
Cliente (localhost:3000)
         ↓
    Proxy Server
    ↙         ↘
NestJS      Symfony
(3001)      (8080)
```

### Cómo Funciona

1. **Proxy Server** (puerto 3000): Recibe todas las peticiones
2. **Routing**: Basado en la ruta, envía a:
   - **NestJS** (puerto 3001): Endpoints migrados
   - **Symfony** (puerto 8080): Endpoints no migrados (fallback)

### Endpoints Migrados

Actualiza `proxy-server.js` cuando migres un endpoint:

```javascript
const NESTJS_ROUTES = [
  '/healthcheck',        // ✅ Migrado
  '/api/healthcheck',    // ✅ Migrado
  // Agregar aquí nuevos endpoints migrados
];
```

## Instalación

### 1. Instalar Dependencias

```bash
# Todas las dependencias están ahora en el root del proyecto
npm install
```

### 2. Configurar Symfony Legacy

```bash
# Asegurarse de que Symfony funciona (ahora en symfony_legacy/)
cd symfony_legacy
symfony server:start --port=8080
```

## Desarrollo

### Opción 1: Script Automático (Recomendado)

```bash
./start-migration-dev.sh
```

Este script:
- Inicia Symfony en puerto 8080
- Inicia NestJS en puerto 3001
- Inicia el proxy en puerto 3000
- Muestra el estado de todos los servicios

### Opción 2: Manual

```bash
# Terminal 1: Symfony Legacy
cd symfony_legacy
symfony server:start --port=8080

# Terminal 2: NestJS (ahora en el root)
npm run start:dev

# Terminal 3: Proxy
node proxy-server.js
```

### Acceso

- **Aplicación Principal**: http://localhost:3000
- **Symfony Directo**: http://localhost:8080
- **NestJS Directo**: http://localhost:3001

## Testing de Migración

### 1. Verificar Health Check (NestJS)

```bash
curl http://localhost:3000/healthcheck
# Debería responder desde NestJS
```

### 2. Verificar Rutas Legacy (Symfony)

```bash
curl http://localhost:3000/login
# Debería responder desde Symfony
```

## Proceso de Migración de un Endpoint

### 1. Identificar el Endpoint en Symfony

```php
// src/Controller/ExampleController.php
#[Route('/api/example', methods: ['GET'])]
public function getExample() {
    // Lógica en PHP
}
```

### 2. Crear el Endpoint en NestJS

```typescript
// src/modules/example/example.controller.ts
@Controller('api')
export class ExampleController {
  @Get('example')
  async getExample() {
    // Lógica en TypeScript
  }
}
```

### 3. Probar el Endpoint

```bash
# Probar directamente en NestJS
curl http://localhost:3001/api/example

# Comparar con Symfony
curl http://localhost:8080/api/example
```

### 4. Activar en el Proxy

Editar `proxy-server.js`:

```javascript
const NESTJS_ROUTES = [
  // ... rutas existentes
  '/api/example',  // ← Agregar nueva ruta
];
```

### 5. Verificar

```bash
# Reiniciar el proxy
# La ruta ahora será manejada por NestJS
curl http://localhost:3000/api/example
```

## Monitoreo

El proxy muestra en consola qué servicio maneja cada petición:

```
[2025-11-15T18:00:00.000Z] GET /healthcheck -> NestJS
[2025-11-15T18:00:01.000Z] GET /login -> Symfony
```

## Estructura del Proyecto

```
exelearning/ (root)
├── src/                        # Código NestJS
│   ├── main.ts                 # Bootstrap de NestJS
│   ├── app.module.ts           # Módulo principal
│   ├── config/
│   │   └── database.config.ts  # Configuración DB
│   └── modules/
│       ├── health/             # Health checks
│       ├── workarea/           # Vista principal
│       ├── auth/               # Autenticación
│       └── project/            # Gestión de proyectos
├── views/                      # Plantillas Nunjucks
│   ├── base.njk
│   └── workarea/
│       └── workarea.njk
├── symfony_legacy/             # Aplicación Symfony legacy
│   ├── src/
│   ├── templates/
│   ├── public/
│   └── config/
├── tsconfig.json
└── package.json
```

## Próximos Pasos

1. **Conectar a BD Real**
   - Configurar TypeORM para usar la BD de Symfony
   - Crear entidades que mapeen las tablas existentes

2. **Migrar OdeApiController**
   - Es el controlador más crítico
   - Dividir OdeService.php en múltiples servicios

3. **Implementar Autenticación Real**
   - Migrar MultiTokenHandler
   - Soportar CAS, OIDC, JWT

4. **WebSockets**
   - Reemplazar Mercure con Socket.io
   - Mantener compatibilidad con frontend

## Troubleshooting

### Puerto en uso

```bash
# Matar proceso en puerto específico
lsof -ti:3000 | xargs kill -9
```

### NestJS no compila

```bash
rm -rf dist
npm run build
```

### Symfony no responde

```bash
cd symfony_legacy
symfony server:stop
symfony server:start --port=8080
```

## Referencias

- [NestJS Documentation](https://docs.nestjs.com)
- [Strangler Fig Pattern](https://martinfowler.com/bliki/StranglerFigApplication.html)
- [TypeORM Documentation](https://typeorm.io)
- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
# eXeLearning CLI Commands - NestJS Migration

Este documento describe los comandos CLI disponibles en la implementación de NestJS de eXeLearning usando NestCommander.

## Uso General

```bash
# En desarrollo (con ts-node)
npm run cli -- <command> [options]

# En producción (código compilado)
npm run cli:prod -- <command> [options]

# Ver ayuda de todos los comandos
npm run cli -- --help

# Ver ayuda de un comando específico
npm run cli -- <command> --help
```

## Comandos Migrados

### Comandos JWT

#### app:jwt:generate

Genera un token JWT local para la API.

**Uso:**
```bash
npm run cli -- app:jwt:generate <sub> [options]
```

**Argumentos:**
- `sub`: Sujeto del token (normalmente email o user ID)

**Opciones:**
- `--ttl <seconds>`: Tiempo de vida en segundos (por defecto: 3600)
- `--issuer <issuer>`: Emisor del token (iss)
- `--audience <audience>`: Audiencia (aud)
- `-c, --claim <k=v>`: Claims adicionales (puede repetirse)
- `--alg <algorithm>`: Algoritmo de firma (por defecto: HS256)
- `--no-iat`: No incluir iat/nbf automáticos

**Ejemplos:**
```bash
# Generar token simple
npm run cli -- app:jwt:generate user@example.com

# Token con claims personalizados
npm run cli -- app:jwt:generate user@example.com --ttl 7200 -c role=admin -c premium=true

# Token con emisor y audiencia
npm run cli -- app:jwt:generate user@example.com --issuer exelearning --audience api.exelearning.net
```

#### app:jwt:validate

Valida y decodifica un token JWT.

**Uso:**
```bash
npm run cli -- app:jwt:validate <jwt> [options]
```

**Argumentos:**
- `jwt`: Token JWT a validar

**Opciones:**
- `--alg <algorithm>`: Algoritmo esperado (por defecto: HS256)
- `--no-verify`: No verificar iss/aud (solo firma/exp)
- `--json`: Salida en formato JSON

**Ejemplos:**
```bash
# Validar token
npm run cli -- app:jwt:validate eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Validar y mostrar en JSON
npm run cli -- app:jwt:validate eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... --json

# Validar sin verificar issuer/audience
npm run cli -- app:jwt:validate eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... --no-verify
```

### Comandos de Usuario

#### app:create-user

Crea un nuevo usuario en la base de datos.

**Alias:** `app:add-user`

**Uso:**
```bash
npm run cli -- app:create-user <email> <password> <user_id> [options]
```

**Argumentos:**
- `email`: Email del usuario
- `password`: Contraseña del usuario
- `user_id`: ID único del usuario

**Opciones:**
- `--no-fail`: No fallar si el usuario ya existe

**Ejemplos:**
```bash
# Crear usuario
npm run cli -- app:create-user user@example.com mypassword user123

# Crear usuario sin fallar si existe
npm run cli -- app:create-user user@example.com mypassword user123 --no-fail
```

#### app:user:role

Gestiona roles de un usuario (añadir/eliminar/listar).

**Alias:** `app:user:promote`, `app:user:demote`

**Uso:**
```bash
npm run cli -- app:user:role <email> [options]
```

**Argumentos:**
- `email`: Email del usuario

**Opciones:**
- `--add <role>`: Role(s) a añadir (puede repetirse)
- `--remove <role>`: Role(s) a eliminar (puede repetirse)
- `--list`: Listar roles actuales y salir
- `--dry-run`: Mostrar cambios sin persistir

**Ejemplos:**
```bash
# Listar roles de un usuario
npm run cli -- app:user:role user@example.com --list

# Añadir roles
npm run cli -- app:user:role user@example.com --add ADMIN --add EDITOR

# Eliminar rol
npm run cli -- app:user:role user@example.com --remove EDITOR

# Dry run para ver cambios
npm run cli -- app:user:role user@example.com --add ADMIN --dry-run
```

#### app:generate-api-key

Genera una clave API aleatoria para un usuario.

**Uso:**
```bash
npm run cli -- app:generate-api-key <user_id> [options]
```

**Argumentos:**
- `user_id`: ID del usuario (puede ser userId, email o ID numérico)

**Opciones:**
- `--overwrite`: Sobrescribir la clave API si ya existe

**Ejemplos:**
```bash
# Generar API key
npm run cli -- app:generate-api-key user@example.com

# Sobrescribir API key existente
npm run cli -- app:generate-api-key user@example.com --overwrite
```

### Comandos de Mantenimiento

#### app:database-test

Prueba la conexión con la base de datos.

**Uso:**
```bash
npm run cli -- app:database-test
```

**Ejemplo:**
```bash
npm run cli -- app:database-test
```

#### app:validate-providers

Valida la configuración de proveedores de la plataforma.

**Nota:** Este comando requiere que se migre `ProviderConfigurationService` desde Symfony.

**Uso:**
```bash
npm run cli -- app:validate-providers
```

## Comandos Pendientes de Migración

Los siguientes comandos están pendientes de migración desde Symfony a NestJS:

### Comandos de Exportación

Estos comandos requieren la migración completa de los servicios de ODE y exportación:

1. **elp:convert** - Convierte archivos .elp antiguos a .elpx
2. **elp:export** - Exporta archivos ELP a múltiples formatos
3. **elp:export-elp** - Re-exporta archivo ELP
4. **elp:export-html5** - Exporta a formato HTML5
5. **elp:export-html5-sp** - Exporta a HTML5 página única
6. **elp:export-ims** - Exporta a formato IMS
7. **elp:export-scorm12** - Exporta a SCORM 1.2
8. **elp:export-scorm2004** - Exporta a SCORM 2004
9. **elp:export-epub3** - Exporta a formato EPUB 3

### Otros Comandos Pendientes

1. **app:translations:extract** - Extrae traducciones y post-procesa archivos XLF
2. **app:tmp-files:cleanup** - Limpia archivos temporales antiguos

## Notas de Migración

### Dependencias Requeridas

Los comandos migrados requieren las siguientes dependencias:

- `nest-commander`: ^3.15.0
- `jsonwebtoken`: ^9.0.2
- `@types/jsonwebtoken`: ^9.0.7
- `bcryptjs`: ^2.4.3
- `uuid`: ^13.0.0

### Variables de Entorno

Los comandos JWT requieren las siguientes variables de entorno (definidas en `.env` o `.env.nestjs`):

```env
JWT_SECRET=your-secret-key
JWT_ISSUER=exelearning  # opcional
JWT_AUDIENCE=api.exelearning.net  # opcional
```

### Estructura de Archivos

```
src/
├── cli.ts                          # Punto de entrada CLI
├── commands/
│   ├── command.module.ts           # Módulo principal de comandos
│   ├── jwt/
│   │   ├── generate-jwt.command.ts
│   │   └── validate-jwt.command.ts
│   ├── user/
│   │   ├── create-user.command.ts
│   │   ├── user-role.command.ts
│   │   └── generate-api-key.command.ts
│   └── maintenance/
│       ├── database-test.command.ts
│       └── validate-providers.command.ts
```

## Próximos Pasos

Para completar la migración de comandos CLI, se recomienda:

1. **Migrar servicios de exportación:**
   - OdeService
   - OdeExportService
   - FileHelper
   - Servicios específicos de formato (HTML5, SCORM, etc.)

2. **Migrar servicios de archivos temporales:**
   - TmpFilesCleanupService

3. **Migrar servicios de traducciones:**
   - TranslationExtractor o servicio equivalente

4. **Migrar servicio de validación de proveedores:**
   - ProviderConfigurationService

5. **Crear tests unitarios** para cada comando migrado

6. **Documentar casos de uso** y ejemplos específicos para cada comando de exportación

## Contribución

Al agregar nuevos comandos CLI:

1. Crear el archivo del comando en la carpeta apropiada dentro de `src/commands/`
2. Importar y registrar el comando en `src/commands/command.module.ts`
3. Agregar documentación en este archivo
4. Crear tests unitarios
5. Actualizar el changelog

## Referencias

- [NestCommander Documentation](https://jmcdo29.github.io/nest-commander/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Comandos originales de Symfony](symfony_legacy/src/Command/)

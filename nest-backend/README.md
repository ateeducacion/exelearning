# eXeLearning NestJS backend (experimental)

Este directorio contiene el código inicial del backend NestJS que convivirá con el backend Symfony actual durante la migración. El objetivo es ofrecer un punto de partida funcional y probado para exponer la API REST v2 mediante Node.js y TypeScript.

## Características incluidas

- Configuración base de NestJS con `ConfigModule`, versionado de rutas y validación global.
- Módulos `Users` y `Projects` con endpoints CRUD mínimos para facilitar pruebas de contrato.
- Almacenamiento en memoria para desacoplar la capa HTTP de la persistencia mientras se preparan los repositorios definitivos.
- Esquema de linters, pruebas unitarias (Jest) y compilación TypeScript alineados con las prácticas del monorepo.

## Primeros pasos

```bash
cd nest-backend
# Instalar dependencias
yarn install
# Servidor de desarrollo con recarga en caliente
yarn start:dev
# Compilar a JavaScript listo para producción
yarn build
```

El servidor escucha en `http://localhost:3000/api/v2` por defecto y acepta la variable `PORT` para personalizar el puerto.

## Próximos pasos sugeridos

1. Sustituir el almacenamiento en memoria por repositorios conectados a la base de datos mediante TypeORM o Prisma.
2. Implementar autenticación y autorización equivalentes a Symfony (usuarios, roles, JWT, CAS/OIDC).
3. Añadir módulos para páginas, bloques e iDevices replicando las operaciones avanzadas de la API actual.
4. Incorporar pruebas de contrato compartidas entre Symfony y NestJS para garantizar paridad funcional.

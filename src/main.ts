import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as nunjucks from 'nunjucks';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

const session = require('express-session');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configure session middleware
  app.use(
    session({
      secret: process.env.APP_SECRET || 'CHANGE_THIS_TO_A_SECRET',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 86400000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  );

  // Enable CORS for development
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  const baseDirCandidates = [
    (process as any).resourcesPath, // Packaged app resources (from Electron)
    join(__dirname, '..'), // ts-node / dev: src -> project root
    join(__dirname, '..', '..'), // compiled: dist/src -> project root
  ];
  const baseDir = baseDirCandidates.find((p) => p && existsSync(p)) || baseDirCandidates[baseDirCandidates.length - 1];

  // Configure Nunjucks for template rendering
  const viewsPath = join(baseDir, 'views');
  // Public directory - prefer packaged extraResources, fallback to repo root
  const publicPathLocal = join(baseDir, 'public');
  const publicPathRoot = join(__dirname, '..', '..', 'public');
  const publicPath = existsSync(publicPathLocal) ? publicPathLocal : publicPathRoot;

  const env = nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app.getHttpAdapter().getInstance(),
    watch: process.env.NODE_ENV === 'development',
  });

  // Add custom filters for Nunjucks
  env.addFilter('dump', (obj) => JSON.stringify(obj, null, 2));
  env.addFilter('safe', (str) => {
    // Mark string as safe by wrapping in nunjucks.runtime.markSafe
    return new nunjucks.runtime.SafeString(str);
  });

  app.setViewEngine('njk');
  app.setBaseViewsDir(viewsPath);

  // Serve static files from the existing public directory
  app.useStaticAssets(publicPath);

  const port = process.env.NEST_PORT || 3001; // Default NestJS port (matches Electron)
  await app.listen(port);

  console.log(`NestJS application is running on: http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();

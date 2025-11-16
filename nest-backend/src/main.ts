import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as nunjucks from 'nunjucks';
import { join } from 'path';
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

  // Configure Nunjucks for template rendering
  const viewsPath = join(__dirname, '..', 'views');
  // Public directory - first try nest-backend/public, then fallback to project root
  const publicPathLocal = join(__dirname, '..', 'public');
  const publicPathRoot = join(__dirname, '..', '..', 'public');
  const publicPath = publicPathLocal;

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

  const port = process.env.NEST_PORT || 3001; // Use 3001 to avoid conflict with Symfony
  await app.listen(port);

  console.log(`NestJS application is running on: http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
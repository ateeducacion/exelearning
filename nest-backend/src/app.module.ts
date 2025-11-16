import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { WorkareaModule } from './modules/workarea/workarea.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { PagesModule } from './modules/pages/pages.module';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      load: [databaseConfig],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        const fs = require('fs');
        const path = require('path');

        const dbPath = path.resolve(__dirname, '../data/exelearning.db');

        return {
          type: 'sqljs',
          database: fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : new Uint8Array(),
          location: dbPath,
          autoSave: true,
          autoSaveInterval: 1000,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false, // Never true in production
          logging: configService.get<string>('NODE_ENV') === 'development',
        } as any;
      },
      inject: [ConfigService],
    }),

    // Feature modules
    HealthModule,
    WorkareaModule,
    AuthModule,
    ProjectModule,
    PagesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
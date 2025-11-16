import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { WorkareaModule } from './modules/workarea/workarea.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectModule } from './modules/project/project.module';
import { PagesModule } from './modules/pages/pages.module';
import { UserPreferencesModule } from './modules/user-preferences/user-preferences.module';
import { OdePropertiesSyncModule } from './modules/ode-properties-sync/ode-properties-sync.module';
import { OdeFilesModule } from './modules/ode-files/ode-files.module';
import { OdeOperationsLogModule } from './modules/ode-operations-log/ode-operations-log.module';
import { CurrentOdeUsersModule } from './modules/current-ode-users/current-ode-users.module';
import { CurrentOdeUsersSyncChangesModule } from './modules/current-ode-users-sync-changes/current-ode-users-sync-changes.module';
import { OdeSyncStructuresModule } from './modules/ode-sync-structures/ode-sync-structures.module';
import { CommandsModule } from './modules/commands/commands.module';
import * as path from 'path';
import * as fs from 'fs';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'], // Load local .env first (takes precedence), then parent .env
      load: [databaseConfig],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();

        const dbPathFromEnv = configService.get<string>('DB_PATH') || '../data/exelearning.db';
        const dbPath = path.isAbsolute(dbPathFromEnv)
          ? dbPathFromEnv
          : path.resolve(__dirname, dbPathFromEnv);
        const dbDir = path.dirname(dbPath);

        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        const initialDb = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : new Uint8Array();

        return {
          type: 'sqljs',
          database: initialDb,
          location: dbPath,
          autoSave: true,
          autoSaveInterval: 1000,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true, // Never true in production
          migrationsRun: true,
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
    UserPreferencesModule,
    OdePropertiesSyncModule,
    OdeFilesModule,
    OdeOperationsLogModule,
    CurrentOdeUsersModule,
    CurrentOdeUsersSyncChangesModule,
    OdeSyncStructuresModule,
    CommandsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

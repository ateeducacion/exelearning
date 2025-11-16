import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from '../config/database.config';
import { User } from '../entities/user.entity';

// JWT Commands
import { GenerateJwtCommand } from './jwt/generate-jwt.command';
import { ValidateJwtCommand } from './jwt/validate-jwt.command';

// User Commands
import { CreateUserCommand } from './user/create-user.command';
import { UserRoleCommand } from './user/user-role.command';
import { GenerateApiKeyCommand } from './user/generate-api-key.command';

// Maintenance Commands
import { DatabaseTestCommand } from './maintenance/database-test.command';
import { ValidateProvidersCommand } from './maintenance/validate-providers.command';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.nestjs'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...databaseConfig(),
        autoLoadEntities: true,
      }),
    }),
    TypeOrmModule.forFeature([User]),
  ],
  providers: [
    // JWT Commands
    GenerateJwtCommand,
    ValidateJwtCommand,
    // User Commands
    CreateUserCommand,
    UserRoleCommand,
    GenerateApiKeyCommand,
    // Maintenance Commands
    DatabaseTestCommand,
    ValidateProvidersCommand,
  ],
})
export class CommandModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { GenerateJwtCommand } from './generate-jwt.command';
import { UserRoleCommand } from './user-role.command';
import { ValidateJwtCommand } from './validate-jwt.command';
import { ValidateProvidersCommand } from './validate-providers.command';
import { ProviderConfigurationService } from './provider-configuration.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule],
  providers: [
    GenerateJwtCommand,
    UserRoleCommand,
    ValidateJwtCommand,
    ValidateProvidersCommand,
    ProviderConfigurationService,
  ],
})
export class CommandsModule {}

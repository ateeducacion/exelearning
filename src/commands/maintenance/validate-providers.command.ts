import { Command, CommandRunner } from 'nest-commander';
import { Injectable } from '@nestjs/common';

@Injectable()
@Command({
  name: 'app:validate-providers',
  description: 'Validate the configuration of platform providers',
})
export class ValidateProvidersCommand extends CommandRunner {
  async run(): Promise<void> {
    console.log('eXeLearning Provider Configuration Validation');
    console.log('='.repeat(50));
    console.log('');
    console.warn('⚠️  This command requires ProviderConfigurationService to be migrated to NestJS.');
    console.warn('   The service is not yet available in the NestJS implementation.');
    console.log('');
    console.log('Status: Pending migration from Symfony to NestJS');
    console.log('');
    console.log('To use this command, please migrate the ProviderConfigurationService');
    console.log('from symfony_legacy/src/Service/ to src/modules/providers/');
    process.exit(1);
  }
}

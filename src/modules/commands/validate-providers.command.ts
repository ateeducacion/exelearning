import { Command, CommandRunner } from 'nest-commander';
import { ProviderConfigurationService } from './provider-configuration.service';

@Command({
  name: 'app:validate-providers',
  description: 'Validate the configuration of platform providers',
})
export class ValidateProvidersCommand extends CommandRunner {
  constructor(
    private readonly providerConfigService: ProviderConfigurationService,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('eXeLearning Provider Configuration Validation');

    const validation = this.providerConfigService.validateConfiguration();
    const statistics = this.providerConfigService.getProviderStatistics();
    const recommendations =
      this.providerConfigService.getConfigurationRecommendations();

    console.log('\nConfiguration Overview');
    console.log(`  Total Providers: ${statistics.total_providers}`);
    console.log(
      `  Configuration Valid: ${statistics.configuration_valid ? 'Yes' : 'No'}`,
    );
    console.log(`  Provider IDs: ${statistics.provider_ids.join(', ')}`);

    if (validation.providers.length > 0) {
      console.log('\nProvider Details');
      console.log('  Provider ID | URL | Reachable');
      validation.providers.forEach((provider) => {
        console.log(
          `  ${provider.id} | ${provider.url || 'Not configured'} | ${
            provider.url_reachable ? '✓' : '✗'
          }`,
        );
      });
    }

    if (validation.valid) {
      console.log('\nProvider configuration is valid!');
    } else {
      console.error('\nProvider configuration has issues:');
      validation.errors.forEach((error) => {
        console.error(`  • ${error}`);
      });
    }

    if (recommendations.length > 0) {
      console.log('\nRecommendations');
      recommendations.forEach((recommendation) => {
        console.log(
          `[${recommendation.type.toUpperCase()}] ${recommendation.message}`,
        );
      });
    }

    process.exit(validation.valid ? 0 : 1);
  }
}

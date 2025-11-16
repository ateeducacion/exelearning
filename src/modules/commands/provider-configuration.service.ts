import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProviderConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  validateConfiguration(): any {
    const errors = this.validateProviderConfiguration();
    const providerIds = this.getProviderIds();
    const providers = [];

    for (const providerId of providerIds) {
      const providerUrl = this.getProviderUrl(providerId);
      const urlReachable = this.checkUrlReachability(providerUrl);
      providers.push({
        id: providerId,
        url: providerUrl,
        url_reachable: urlReachable,
      });

      if (!urlReachable) {
        errors.push(`Provider URL not reachable: ${providerUrl}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      providers,
    };
  }

  getProviderStatistics(): any {
    const providerIds = this.getProviderIds();
    return {
      total_providers: providerIds.length,
      configuration_valid: this.validateProviderConfiguration().length === 0,
      provider_ids: providerIds,
    };
  }

  getConfigurationRecommendations(): any[] {
    const recommendations = [];
    const providerIds = this.getProviderIds();

    if (providerIds.length === 0) {
      recommendations.push({
        type: 'warning',
        message:
          'No providers configured. Add PROVIDER_URLS, PROVIDER_TOKENS, and PROVIDER_IDS to environment.',
      });
    } else if (providerIds.length === 1) {
      recommendations.push({
        type: 'info',
        message:
          'Single provider configured. Consider adding backup providers for redundancy.',
      });
    }

    for (const providerId of providerIds) {
      const url = this.getProviderUrl(providerId);
      if (url && !url.startsWith('https://')) {
        recommendations.push({
          type: 'security',
          message: `Provider ${providerId} uses HTTP instead of HTTPS. Consider upgrading for security.`,
        });
      }
    }

    return recommendations;
  }

  private getProviderIds(): string[] {
    const ids = this.configService.get<string>('PROVIDER_IDS');
    if (!ids) {
      const defaultId = this.configService.get<string>('DEFAULT_PROVIDER_ID');
      return defaultId ? [defaultId] : [];
    }
    return ids.split(',');
  }

  private getProviderUrl(providerId: string): string | null {
    const ids = this.getProviderIds();
    const index = ids.indexOf(providerId);
    if (index === -1) {
      return null;
    }

    const urls = this.configService.get<string>('PROVIDER_URLS')?.split(',');
    if (urls && urls[index]) {
      return urls[index];
    }

    return this.configService.get<string>('DEFAULT_PROVIDER_URL') || null;
  }

  private validateProviderConfiguration(): string[] {
    const errors = [];
    const urls = this.configService.get<string>('PROVIDER_URLS')?.split(',') || [];
    const tokens = this.configService.get<string>('PROVIDER_TOKENS')?.split(',') || [];
    const ids = this.configService.get<string>('PROVIDER_IDS')?.split(',') || [];

    if (urls.length !== tokens.length || urls.length !== ids.length) {
      errors.push(
        'PROVIDER_URLS, PROVIDER_TOKENS, and PROVIDER_IDS must have the same number of items.',
      );
    }

    if (ids.length !== new Set(ids).size) {
      errors.push('Duplicate provider IDs found.');
    }

    return errors;
  }

  private checkUrlReachability(url: string | null): boolean {
    if (!url) {
      return false;
    }
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
}

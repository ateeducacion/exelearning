import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { ConfigService} from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

interface GenerateJwtOptions {
  ttl?: number;
  issuer?: string;
  audience?: string;
  claim?: string[];
  alg?: string;
  noIat?: boolean;
}

@Injectable()
@Command({
  name: 'app:jwt:generate',
  description: 'Generates a local JWT (HS256) for the API',
  arguments: '<sub>',
  argsDescription: {
    sub: 'Token subject (usually email or user id)',
  },
})
export class GenerateJwtCommand extends CommandRunner {
  constructor(private configService: ConfigService) {
    super();
  }

  async run(inputs: string[], options: GenerateJwtOptions): Promise<void> {
    const sub = inputs[0];
    const ttl = options.ttl || 3600;
    const alg = options.alg || 'HS256';
    const secret = this.configService.get<string>('JWT_SECRET') || 'your-secret-key';
    const issuer = options.issuer || this.configService.get<string>('JWT_ISSUER');
    const audience = options.audience || this.configService.get<string>('JWT_AUDIENCE');

    const now = Math.floor(Date.now() / 1000);
    const payload: any = {
      sub,
      exp: now + Math.max(1, ttl),
    };

    if (!options.noIat) {
      payload.iat = now;
      payload.nbf = now;
    }

    if (issuer) {
      payload.iss = issuer;
    }
    if (audience) {
      payload.aud = audience;
    }

    // Parse extra claims k=v
    const claims = options.claim || [];
    for (const kv of claims) {
      if (!kv.includes('=')) {
        console.warn(`Claim ignored (format k=v required): ${kv}`);
        continue;
      }
      const [k, v] = kv.split('=', 2);
      const key = k.trim();
      let value: any = v.trim();

      if (key === '' || ['exp', 'iat', 'nbf'].includes(key)) {
        console.warn(`Reserved or empty claim ignored: ${key}`);
        continue;
      }

      // Try to cast numeric/bool
      if (!isNaN(Number(value))) {
        value = value.includes('.') ? parseFloat(value) : parseInt(value, 10);
      } else if (['true', 'false'].includes(value.toLowerCase())) {
        value = value.toLowerCase() === 'true';
      }
      payload[key] = value;
    }

    try {
      const token = jwt.sign(payload, secret, { algorithm: alg as jwt.Algorithm });
      console.log(token);
      process.exit(0);
    } catch (error) {
      console.error('Error signing the token:', error.message);
      process.exit(1);
    }
  }

  @Option({
    flags: '--ttl [ttl]',
    description: 'Time to live in seconds',
    defaultValue: 3600,
  })
  parseTtl(val: string): number {
    return parseInt(val, 10);
  }

  @Option({
    flags: '--issuer [issuer]',
    description: 'Issuer (iss). Default: configured one',
  })
  parseIssuer(val: string): string {
    return val;
  }

  @Option({
    flags: '--audience [audience]',
    description: 'Audience (aud). Default: configured one',
  })
  parseAudience(val: string): string {
    return val;
  }

  @Option({
    flags: '-c, --claim [claim...]',
    description: 'Additional claims (k=v). Can be repeated',
  })
  parseClaim(val: string, previous: string[] = []): string[] {
    return [...previous, val];
  }

  @Option({
    flags: '--alg [alg]',
    description: 'Signing algorithm',
    defaultValue: 'HS256',
  })
  parseAlg(val: string): string {
    return val;
  }

  @Option({
    flags: '--no-iat',
    description: 'Do not include automatic iat/nbf',
  })
  parseNoIat(): boolean {
    return true;
  }
}

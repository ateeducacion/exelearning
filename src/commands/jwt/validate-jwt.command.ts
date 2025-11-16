import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

interface ValidateJwtOptions {
  alg?: string;
  noVerify?: boolean;
  json?: boolean;
}

@Injectable()
@Command({
  name: 'app:jwt:validate',
  description: 'Validates/decodes a local JWT (HS256) and shows its claims',
  arguments: '<jwt>',
  argsDescription: {
    jwt: 'JWT token to validate',
  },
})
export class ValidateJwtCommand extends CommandRunner {
  constructor(private configService: ConfigService) {
    super();
  }

  async run(inputs: string[], options: ValidateJwtOptions): Promise<void> {
    const token = inputs[0];
    const alg = options.alg || 'HS256';
    const secret = this.configService.get<string>('JWT_SECRET') || 'your-secret-key';
    const issuer = this.configService.get<string>('JWT_ISSUER');
    const audience = this.configService.get<string>('JWT_AUDIENCE');

    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: [alg as jwt.Algorithm],
      }) as jwt.JwtPayload;

      if (!options.noVerify) {
        if (issuer && decoded.iss !== issuer) {
          console.error('Invalid issuer');
          process.exit(1);
        }
        if (audience && decoded.aud !== audience) {
          console.error('Invalid audience');
          process.exit(1);
        }
      }

      if (options.json) {
        console.log(JSON.stringify(decoded, null, 2));
      } else {
        console.log('✓ Valid token');
        console.log('');
        for (const [key, value] of Object.entries(decoded)) {
          const displayValue =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
          console.log(`${key}: ${displayValue}`);
        }
      }
      process.exit(0);
    } catch (error) {
      console.error('Invalid token:', error.message);
      process.exit(1);
    }
  }

  @Option({
    flags: '--alg [alg]',
    description: 'Algorithm',
    defaultValue: 'HS256',
  })
  parseAlg(val: string): string {
    return val;
  }

  @Option({
    flags: '--no-verify',
    description: 'Do not verify iss/aud (only signature/exp)',
  })
  parseNoVerify(): boolean {
    return true;
  }

  @Option({
    flags: '--json',
    description: 'Output in JSON',
  })
  parseJson(): boolean {
    return true;
  }
}

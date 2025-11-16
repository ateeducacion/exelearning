import { Command, CommandRunner, Option } from 'nest-commander';
import * as jwt from 'jsonwebtoken';

interface ValidateJwtCommandOptions {
  alg?: string;
  'no-verify'?: boolean;
  json?: boolean;
}

@Command({
  name: 'app:jwt:validate',
  description: 'Validates/decodes a local JWT (HS256) and shows its claims',
  arguments: '<jwt>',
})
export class ValidateJwtCommand extends CommandRunner {
  constructor() {
    super();
  }

  async run(
    passedParam: string[],
    options?: ValidateJwtCommandOptions,
  ): Promise<void> {
    const [token] = passedParam;
    const { alg = 'HS256', 'no-verify': noVerify, json } = options;

    try {
      const decoded = jwt.verify(token, process.env.APP_SECRET || 'secret', {
        algorithms: [alg as jwt.Algorithm],
      });

      if (typeof decoded === 'string') {
        console.error('Invalid token: received a string instead of an object');
        process.exit(1);
      }

      if (!noVerify) {
        if (process.env.JWT_ISSUER && decoded.iss !== process.env.JWT_ISSUER) {
          console.error('Invalid issuer');
          process.exit(1);
        }
        if (
          process.env.JWT_AUDIENCE &&
          decoded.aud !== process.env.JWT_AUDIENCE
        ) {
          console.error('Invalid audience');
          process.exit(1);
        }
      }

      if (json) {
        console.log(JSON.stringify(decoded, null, 2));
      } else {
        console.log('Valid token');
        Object.entries(decoded).forEach(([key, value]) => {
          console.log(
            `${key}: ${
              typeof value === 'string' ? value : JSON.stringify(value)
            }`,
          );
        });
      }
    } catch (e) {
      console.error(`Invalid token: ${e.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '--alg <alg>',
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

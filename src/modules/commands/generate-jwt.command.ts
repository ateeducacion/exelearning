import { Command, CommandRunner, Option } from 'nest-commander';
import * as jwt from 'jsonwebtoken';

interface GenerateJwtCommandOptions {
  ttl?: number;
  issuer?: string;
  audience?: string;
  claim?: string[];
  alg?: string;
  'no-iat'?: boolean;
}

@Command({
  name: 'app:jwt:generate',
  description: 'Generates a local JWT (HS256) for the API',
  arguments: '<sub>',
})
export class GenerateJwtCommand extends CommandRunner {
  constructor() {
    super();
  }

  async run(
    passedParam: string[],
    options?: GenerateJwtCommandOptions,
  ): Promise<void> {
    const [sub] = passedParam;
    const {
      ttl = 3600,
      issuer,
      audience,
      claim: claims = [],
      alg = 'HS256',
      'no-iat': noIat,
    } = options;

    const now = Math.floor(Date.now() / 1000);
    const payload: any = {
      sub,
      exp: now + Math.max(1, ttl),
    };

    if (!noIat) {
      payload.iat = now;
      payload.nbf = now;
    }

    if (issuer) {
      payload.iss = issuer;
    }
    if (audience) {
      payload.aud = audience;
    }

    claims.forEach((kv) => {
      if (!kv.includes('=')) {
        console.warn(`Claim ignored (format k=v required): ${kv}`);
        return;
      }
      const [k, v] = kv.split('=', 2);
      const key = k.trim();
      let value: any = v.trim();
      if (
        key === '' ||
        key === 'exp' ||
        key === 'iat' ||
        key === 'nbf'
      ) {
        console.warn(`Reserved or empty claim ignored: ${key}`);
        return;
      }
      if (!isNaN(Number(value))) {
        value = value.includes('.') ? parseFloat(value) : parseInt(value, 10);
      } else if (value.toLowerCase() === 'true') {
        value = true;
      } else if (value.toLowerCase() === 'false') {
        value = false;
      }
      payload[key] = value;
    });

    try {
      const token = jwt.sign(payload, process.env.APP_SECRET || 'secret', {
        algorithm: alg as jwt.Algorithm,
      });
      console.log(token);
    } catch (e) {
      console.error(`Error signing the token: ${e.message}`);
      process.exit(1);
    }
  }

  @Option({
    flags: '--ttl <ttl>',
    description: 'Time to live in seconds',
    defaultValue: '3600',
  })
  parseTtl(val: string): number {
    return parseInt(val, 10);
  }

  @Option({
    flags: '--issuer <issuer>',
    description: 'Issuer (iss). Default: configured one',
  })
  parseIssuer(val: string): string {
    return val;
  }

  @Option({
    flags: '--audience <audience>',
    description: 'Audience (aud). Default: configured one',
  })
  parseAudience(val: string): string {
    return val;
  }

  @Option({
    flags: '-c, --claim <claim>',
    description: 'Additional claims (k=v). Can be repeated',
  })
  parseClaim(val: string): string[] {
    return val.split(',');
  }

  @Option({
    flags: '--alg <alg>',
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

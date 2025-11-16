import { Command, CommandRunner, Option } from 'nest-commander';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

interface UserRoleCommandOptions {
  add?: string[];
  remove?: string[];
  list?: boolean;
  'dry-run'?: boolean;
}

@Command({
  name: 'app:user:role',
  description: 'Manage roles for a user (add/remove/list by email)',
  arguments: '<email>',
  aliases: ['app:user:promote', 'app:user:demote'],
})
export class UserRoleCommand extends CommandRunner {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super();
  }

  async run(
    passedParam: string[],
    options?: UserRoleCommandOptions,
  ): Promise<void> {
    const [email] = passedParam;
    const {
      add: adds = [],
      remove: removes = [],
      list,
      'dry-run': dryRun,
    } = options;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    let roles = [...new Set(user.roles)];

    if (list) {
      roles.sort();
      console.log(roles.join('\n'));
      return;
    }

    if (adds.length === 0 && removes.length === 0) {
      console.error(
        'Provide at least one option: --add ROLE_X or --remove ROLE_Y (or use --list).',
      );
      process.exit(1);
    }

    const originalRoles = [...roles];
    const added = [];
    const removed = [];

    removes.forEach((role) => {
      const normalizedRole = this.normalizeRole(role);
      if (normalizedRole === 'ROLE_USER') {
        console.warn('ROLE_USER cannot be removed; skipping.');
        return;
      }
      if (roles.includes(normalizedRole)) {
        roles = roles.filter((r) => r !== normalizedRole);
        removed.push(normalizedRole);
      } else {
        console.info(
          `User ${email} does not have role ${normalizedRole}; skipping.`,
        );
      }
    });

    adds.forEach((role) => {
      const normalizedRole = this.normalizeRole(role);
      if (!roles.includes(normalizedRole)) {
        roles.push(normalizedRole);
        added.push(normalizedRole);
      } else {
        console.info(
          `User ${email} already has role ${normalizedRole}; skipping.`,
        );
      }
    });

    if (JSON.stringify(originalRoles.sort()) === JSON.stringify(roles.sort())) {
      console.log('No changes.');
      return;
    }

    roles.sort();

    if (dryRun) {
      console.log('Dry-run: changes not persisted.');
      console.log('Resulting roles:');
      console.log(roles.join('\n'));
      return;
    }

    user.roles = roles;
    await this.userRepository.save(user);

    if (added.length > 0) {
      console.log(`Added: ${added.join(', ')}`);
    }
    if (removed.length > 0) {
      console.log(`Removed: ${removed.join(', ')}`);
    }
  }

  @Option({
    flags: '--add <roles>',
    description: 'Role(s) to add (repeat to add multiple)',
  })
  parseAdd(val: string): string[] {
    return val.split(',');
  }

  @Option({
    flags: '--remove <roles>',
    description: 'Role(s) to remove (repeat to remove multiple)',
  })
  parseRemove(val: string): string[] {
    return val.split(',');
  }

  @Option({
    flags: '--list',
    description: 'List current roles and exit',
  })
  parseList(): boolean {
    return true;
  }

  @Option({
    flags: '--dry-run',
    description: 'Show resulting roles but do not persist',
  })
  parseDryRun(): boolean {
    return true;
  }

  private normalizeRole(role: string): string {
    let normalized = role.toUpperCase().trim();
    if (!normalized.startsWith('ROLE_')) {
      normalized = `ROLE_${normalized}`;
    }
    return normalized.replace(/[^A-Z0-9_]/g, '');
  }
}

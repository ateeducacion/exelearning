import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

interface UserRoleOptions {
  add?: string[];
  remove?: string[];
  list?: boolean;
  dryRun?: boolean;
}

@Injectable()
@Command({
  name: 'app:user:role',
  description: 'Manage roles for a user (add/remove/list by email)',
  aliases: ['app:user:promote', 'app:user:demote'],
  arguments: '<email>',
  argsDescription: {
    email: 'User email',
  },
})
export class UserRoleCommand extends CommandRunner {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super();
  }

  async run(inputs: string[], options: UserRoleOptions): Promise<void> {
    const email = inputs[0];

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    let roles = Array.from(new Set(user.roles || ['ROLE_USER']));

    // --list: print and exit early
    if (options.list) {
      roles.sort();
      console.log(roles.join('\n'));
      process.exit(0);
    }

    const adds = (options.add || []).map((r) => this.normalizeRole(r));
    const removes = (options.remove || []).map((r) => this.normalizeRole(r));

    if (adds.length === 0 && removes.length === 0) {
      console.error(
        'Provide at least one option: --add ROLE_X or --remove ROLE_Y (or use --list).',
      );
      process.exit(2);
    }

    const original = [...roles];
    const added: string[] = [];
    const removed: string[] = [];

    // Apply removals (protect ROLE_USER)
    for (const role of removes) {
      if (role === 'ROLE_USER') {
        console.warn('ROLE_USER cannot be removed; skipping.');
        continue;
      }
      if (roles.includes(role)) {
        roles = roles.filter((r) => r !== role);
        removed.push(role);
      } else {
        console.log(`User ${email} does not have role ${role}; skipping.`);
      }
    }

    // Apply additions
    for (const role of adds) {
      if (!roles.includes(role)) {
        roles.push(role);
        added.push(role);
      } else {
        console.log(`User ${email} already has role ${role}; skipping.`);
      }
    }

    // No changes?
    if (JSON.stringify(original.sort()) === JSON.stringify(roles.sort())) {
      console.log('No changes.');
      process.exit(0);
    }

    roles.sort();

    if (options.dryRun) {
      console.log('Dry-run: changes not persisted.');
      console.log('Resulting roles:');
      console.log(roles.join('\n'));
      process.exit(0);
    }

    user.roles = roles;
    await this.userRepository.save(user);

    if (added.length > 0) {
      console.log(`✓ Added: ${added.join(', ')}`);
    }
    if (removed.length > 0) {
      console.log(`✓ Removed: ${removed.join(', ')}`);
    }

    process.exit(0);
  }

  /**
   * Normalize an input into a valid role name.
   * Ensures uppercase and ROLE_ prefix. Strips invalid chars.
   */
  private normalizeRole(role: string): string {
    let normalized = role.trim().toUpperCase();
    if (!normalized.startsWith('ROLE_')) {
      normalized = 'ROLE_' + normalized;
    }
    // Keep only A-Z, 0-9 and underscore
    normalized = normalized.replace(/[^A-Z0-9_]/g, '') || 'ROLE_';
    return normalized;
  }

  @Option({
    flags: '--add [role...]',
    description: 'Role(s) to add (repeat to add multiple)',
  })
  parseAdd(val: string, previous: string[] = []): string[] {
    return [...previous, val];
  }

  @Option({
    flags: '--remove [role...]',
    description: 'Role(s) to remove (repeat to remove multiple)',
  })
  parseRemove(val: string, previous: string[] = []): string[] {
    return [...previous, val];
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
}

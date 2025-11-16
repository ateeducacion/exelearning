import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

interface GenerateApiKeyOptions {
  overwrite?: boolean;
}

@Injectable()
@Command({
  name: 'app:generate-api-key',
  description: 'Generates a random API key for the specified user',
  arguments: '<user_id>',
  argsDescription: {
    user_id: 'The ID of the user to generate the API key for',
  },
})
export class GenerateApiKeyCommand extends CommandRunner {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super();
  }

  async run(inputs: string[], options: GenerateApiKeyOptions): Promise<void> {
    const userId = inputs[0];

    // Try to find user by userId first
    let user = await this.userRepository.findOne({
      where: { userId },
    });

    // If not found, try by email
    if (!user) {
      user = await this.userRepository.findOne({
        where: { email: userId },
      });
    }

    // If not found and input is numeric, try by id
    if (!user && !isNaN(Number(userId))) {
      user = await this.userRepository.findOne({
        where: { id: parseInt(userId, 10) },
      });
    }

    if (!user) {
      console.error(`User with ID/email "${userId}" not found.`);
      process.exit(1);
    }

    if (user.apiToken && !options.overwrite) {
      console.error('User already has an API token. Use --overwrite to replace it.');
      process.exit(1);
    }

    // Generate new API key
    const apiKey = uuidv4();
    const hashedApiKey = await bcrypt.hash(apiKey, 10);
    user.apiToken = hashedApiKey;

    await this.userRepository.save(user);

    console.log(`✓ API key generated for user ${user.email} (${user.userId}).`);
    console.log('');
    console.log('Your API Key (raw UUID - store it securely, it will not be shown again):');
    console.log(apiKey);
    process.exit(0);
  }

  @Option({
    flags: '--overwrite',
    description: 'Overwrite the API key if it already exists',
  })
  parseOverwrite(): boolean {
    return true;
  }
}

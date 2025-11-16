import { Command, CommandRunner, Option } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import * as bcrypt from 'bcryptjs';

interface CreateUserOptions {
  noFail?: boolean;
}

@Injectable()
@Command({
  name: 'app:create-user',
  description: 'Creates a new user',
  aliases: ['app:add-user'],
  arguments: '<email> <password> <user_id>',
  argsDescription: {
    email: 'The email of the user',
    password: 'The password of the user',
    user_id: 'The user ID',
  },
})
export class CreateUserCommand extends CommandRunner {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super();
  }

  async run(inputs: string[], options: CreateUserOptions): Promise<void> {
    const [email, password, userId] = inputs;

    // Check if the user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      console.error(`User with email ${email} already exists!`);
      process.exit(options.noFail ? 0 : 1);
    }

    // Create a new User entity
    const user = new User();
    user.email = email;
    user.userId = userId;
    user.isLopdAccepted = true;

    // Hash the password and set it
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;

    // Persist the new user entity to the database
    await this.userRepository.save(user);

    console.log('User successfully created!');
    process.exit(0);
  }

  @Option({
    flags: '--no-fail',
    description: 'If set, the command will not fail if the user already exists',
  })
  parseNoFail(): boolean {
    return true;
  }
}

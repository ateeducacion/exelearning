import { CommandFactory } from 'nest-commander';
import { CommandModule } from './commands/command.module';

async function bootstrap() {
  await CommandFactory.run(CommandModule, {
    logger: ['error', 'warn', 'log'],
    errorHandler: (err) => {
      console.error('Command failed:', err.message);
      process.exit(1);
    },
  });
}

bootstrap();

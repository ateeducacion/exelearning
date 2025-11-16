import { Command, CommandRunner } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
@Command({
  name: 'app:database-test',
  description: 'Tests database connection',
})
export class DatabaseTestCommand extends CommandRunner {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('');
    console.log('Database Connection Test');
    console.log('=========================');
    console.log('');

    try {
      // Check if the connection is established
      if (this.dataSource.isInitialized) {
        // Try a simple query to verify connection
        await this.dataSource.query('SELECT 1');
        console.log('✓ Database connection successful!');
        process.exit(0);
      } else {
        console.error('✗ Database connection failed: DataSource not initialized');
        process.exit(1);
      }
    } catch (error) {
      console.error(`✗ Database connection failed: ${error.message}`);
      process.exit(1);
    }
  }
}

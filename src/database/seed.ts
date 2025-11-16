import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as fs from 'fs';

const initSqlJs = require('sql.js');

async function seed() {
  console.log('Initializing database...');

  // Initialize sql.js
  const SQL = await initSqlJs();
  const dbPath = path.resolve(__dirname, '../../data/exelearning.db');

  // Create data directory if it doesn't exist
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create database
  const db = new SQL.Database();

  // Create users table
  console.log('Creating users table...');
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(180) UNIQUE NOT NULL,
      user_id VARCHAR(40) NOT NULL,
      password VARCHAR(255) NOT NULL,
      roles TEXT NOT NULL,
      is_lopd_accepted BOOLEAN DEFAULT 0,
      quota_mb INTEGER,
      external_identifier VARCHAR(180),
      api_token VARCHAR(255),
      created_at DATETIME,
      updated_at DATETIME
    )
  `);

  // Hash password
  console.log('Hashing password...');
  const hashedPassword = await bcrypt.hash('1234', 10);

  // Insert test user
  console.log('Creating test user...');
  db.run(`
    INSERT INTO users (
      email, user_id, password, roles, is_lopd_accepted,
      quota_mb, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'user@exelearning.net',
    'user',
    hashedPassword,
    JSON.stringify(['ROLE_USER']),
    1,
    4096,
    new Date().toISOString(),
    new Date().toISOString(),
  ]);

  // Save database to file
  console.log(`Saving database to ${dbPath}...`);
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log('✓ Database initialized successfully!');
  console.log('✓ Test user created:');
  console.log('  Email: user@exelearning.net');
  console.log('  Password: 1234');

  db.close();
}

seed().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});

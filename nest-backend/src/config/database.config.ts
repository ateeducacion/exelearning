import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: process.env.DB_DRIVER || 'sqlite',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_PATH || '../data/exelearning.db',
  entities: [],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
}));
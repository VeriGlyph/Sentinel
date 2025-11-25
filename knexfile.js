require('dotenv').config();

module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER || 'veriglyph',
    password: process.env.DB_PASSWORD || 'veriglyph',
    database: process.env.DB_NAME || 'veriglyph_indexer',
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
};

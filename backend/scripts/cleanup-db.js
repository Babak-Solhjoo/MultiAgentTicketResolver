require('dotenv').config();

const mysql = require('mysql2/promise');

const tablesToDrop = [
  'evidence',
  'agent_messages',
  'agent_runs',
  'actions',
  'customers',
  'rag_articles',
  'resolution_capsules'
];

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tablesToDrop) {
      await connection.execute(`DROP TABLE IF EXISTS ${table}`);
    }
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Dropped redundant tables:', tablesToDrop.join(', '));
  } finally {
    await connection.end();
  }
}

run().catch((err) => {
  console.error('Failed to drop tables:', err.message);
  process.exit(1);
});

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadStatements() {
  const sqlPath = path.resolve(__dirname, '..', '..', 'db', 'init.sql');
  const raw = fs.readFileSync(sqlPath, 'utf8');
  const filtered = raw
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim().toUpperCase();
      return !trimmed.startsWith('CREATE DATABASE') && !trimmed.startsWith('USE ');
    })
    .join('\n');

  return filtered
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(Boolean);
}

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const statements = loadStatements();
    for (const statement of statements) {
      await connection.execute(statement);
    }
    console.log('Database schema applied.');
  } finally {
    await connection.end();
  }
}

run().catch((err) => {
  console.error('Failed to apply schema:', err.message);
  process.exit(1);
});

require('dotenv').config();

const mysql = require('mysql2/promise');

const columns = [
  { name: 'priority', ddl: "ALTER TABLE tickets ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'Medium'" },
  { name: 'company', ddl: "ALTER TABLE tickets ADD COLUMN company VARCHAR(160) DEFAULT NULL" },
  { name: 'assignees_json', ddl: "ALTER TABLE tickets ADD COLUMN assignees_json JSON DEFAULT NULL" }
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
    const [rows] = await connection.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
      , [process.env.DB_NAME, 'tickets']
    );
    const existing = new Set(rows.map((row) => row.COLUMN_NAME));

    for (const column of columns) {
      if (!existing.has(column.name)) {
        await connection.execute(column.ddl);
      }
    }

    console.log('Ticket table migration complete.');
  } finally {
    await connection.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

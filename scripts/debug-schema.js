
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'prisma/dev.db');
const db = new Database(dbPath);

const columns = db.pragma('table_info(active_sessions)');
console.log('Columns in active_sessions:', columns.map(c => c.name));

const sample = db.prepare('SELECT * FROM active_sessions LIMIT 1').get();
console.log('Sample row:', sample);

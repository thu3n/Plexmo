
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'prisma/dev.db');
const db = new Database(dbPath);

console.log("--- COLUMNS ---");
const columns = db.pragma('table_info(active_sessions)');
columns.forEach(c => console.log(c.name));

console.log("\n--- SMALPLE ROW ---");
const sample = db.prepare('SELECT * FROM active_sessions LIMIT 1').get();
if (sample) {
    console.log(JSON.stringify(sample, null, 2));
} else {
    console.log("No active sessions found.");
}

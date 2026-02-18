const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    // Fallback to dev.db if config db not found, just in case
    const devDbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    if (fs.existsSync(devDbPath)) {
        console.log(`Falling back to ${devDbPath}`);
        checkStats(devDbPath);
    } else {
        process.exit(1);
    }
} else {
    checkStats(dbPath);
}

function checkStats(databasePath) {
    const db = new Database(databasePath);
    try {
        console.log(`Connected to ${databasePath}`);
        console.log('\n--- Repair Status Distribution ---');

        // Group by status
        const rows = db.prepare(`
        SELECT 
          COALESCE(repair_status, 'NULL (pending)') as status, 
          COUNT(*) as count 
        FROM activity_history 
        GROUP BY repair_status
        ORDER BY count DESC
      `).all();

        rows.forEach(r => console.log(`${r.status}: ${r.count}`));

        // Total count
        const total = db.prepare('SELECT COUNT(*) as c FROM activity_history').get().c;
        console.log(`Total rows: ${total}`);

    } catch (error) {
        console.error('Error executing query:', error.message);
    }
}


const { db } = require('./src/lib/db');
console.log('--- DB STATUS ---');
try {
    const count = db.prepare('SELECT COUNT(*) as c FROM UnifiedItem').get();
    console.log('UnifiedItem Count:', count.c);
} catch (e) {
    console.log('Error reading UnifiedItem:', e.message);
}

try {
    const job = db.prepare("SELECT * FROM jobs WHERE type='unify_library' ORDER BY createdAt DESC LIMIT 1").get();
    console.log('Last Unify Job:', job);
} catch (e) {
    console.log('Error reading Jobs:', e.message);
}

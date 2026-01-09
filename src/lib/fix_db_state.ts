
import { db } from "./db";
import fs from "fs";

console.log("Running diagnostics...");

try {
    const counts = db.prepare("SELECT COUNT(*) as c FROM UnifiedItem").get() as any;
    const items = db.prepare("SELECT COUNT(*) as c FROM library_items WHERE unifiedItemId IS NOT NULL").get() as any;
    const jobs = db.prepare("SELECT * FROM jobs WHERE status = 'running'").all();

    const report = `
Time: ${new Date().toISOString()}
UnifiedItem Count: ${counts.c}
Linked Items Count: ${items.c}
Running Jobs: ${JSON.stringify(jobs, null, 2)}
    `;

    fs.writeFileSync("status_report.txt", report);
    console.log("Report generated in status_report.txt");

    // Force Reset Stuck Jobs
    const info = db.prepare("UPDATE jobs SET status = 'failed', message = 'Reset by system' WHERE status = 'running'").run();
    console.log(`Reset ${info.changes} stuck jobs.`);

} catch (e: any) {
    console.error("DIAGNOSTIC ERROR:", e);
    fs.writeFileSync("status_report.txt", `ERROR: ${e.message}`);
}


import { getGroupItemsPaginated } from "./library_groups";

// Test ID known to exist (used in previous user request)
const ID = "b18c91cc-f95b-4775-bb44-14c00c7bee2e";

console.log("Testing getGroupItemsPaginated...");
try {
    const result = getGroupItemsPaginated(ID, 1, 50, "");
    console.log("Success!");
    console.log("Total Count:", result.totalCount);
    console.log("Items Returned:", result.items.length);
    if (result.items.length > 0) {
        console.log("First Item ID:", result.items[0].id);
        console.log("First Item Title:", result.items[0].title);
    }
} catch (e: any) {
    console.error("Test Failed:", e.message);
    if (e.message.includes("syntax")) console.error("Details:", e);
}

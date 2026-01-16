
import { unifyLibraryItems } from "./services/unification_service";

async function run() {
    console.log("Forcing Full Unification...");
    try {
        const result = await unifyLibraryItems(true);
        console.log("Result:", result);
    } catch (e) {
        console.error("Failed:", e);
    }
}

if (require.main === module) {
    run();
}

import { listInternalServers } from "@/lib/servers";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
    // Check if there are any servers configured
    try {
        const servers = await listInternalServers();
        // console.log(`[LoginPage] Checked servers. Count: ${servers.length}`);

        // if (servers.length === 0) { ... }
    } catch (e) {
        console.error("[LoginPage] Failed to list servers:", e);
    }

    // Configured setup -> Show Normal Login
    return <LoginForm />;
}

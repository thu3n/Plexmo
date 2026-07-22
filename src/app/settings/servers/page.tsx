import { redirect } from "next/navigation";
import { ServersTab } from "@/features/server/components/settings/ServersTab";

export default async function ServersSettingsPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    // Users used to live as a tab here — keep old ?tab=users links working.
    const { tab } = await searchParams;
    if (tab === "users") redirect("/settings/users");

    return <ServersTab />;
}

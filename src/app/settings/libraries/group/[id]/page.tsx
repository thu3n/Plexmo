import { getLibraryGroup } from "@/lib/library_groups";
import ClientPage from "./ClientPage";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch group details on the server for instant title rendering
    const group = getLibraryGroup(id);

    return <ClientPage id={id} group={group} />;
}

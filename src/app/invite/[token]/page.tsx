import type { Metadata } from "next";
import { InviteClient } from "@/features/setup/components/InviteClient";

export const metadata: Metadata = { title: "You're invited - Plexmo" };

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
    const { token } = await props.params;
    return <InviteClient token={token} />;
}

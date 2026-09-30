import { notFound } from "next/navigation";
import { TitleDetailLayout } from "@/features/stats-v2/components/explore/TitleDetailLayout";

export const metadata = {
    title: "Title statistics",
};

const MEDIA_ID_PATTERN = /^\d{1,12}$/;

export default async function TitleStatisticsPage({ params }: { params: Promise<{ mediaId: string }> }) {
    const { mediaId } = await params;
    if (!MEDIA_ID_PATTERN.test(mediaId)) notFound();
    // Data (and its authorization) come from /api/stats/title/[mediaId]; the page is only a shell.
    return <TitleDetailLayout mediaId={Number(mediaId)} />;
}

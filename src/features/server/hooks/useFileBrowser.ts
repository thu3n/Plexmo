import { useState } from "react";
import useSWR from "swr";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";

type FileItem = {
    name: string;
    type: "directory" | "file";
    path: string;
};

type FileResponse = {
    currentPath: string;
    parent: string | null;
    items: FileItem[];
};

export function useFileBrowser(initialPath: string = "", isOpen: boolean = true) {
    const [requestedPath, setRequestedPath] = useState(initialPath);
    const [wasOpen, setWasOpen] = useState(isOpen);

    // Every fresh open starts back at initialPath, not wherever the last
    // session navigated to.
    if (isOpen !== wasOpen) {
        setWasOpen(isOpen);
        if (isOpen) setRequestedPath(initialPath);
    }

    const { data, error, isLoading } = useSWR<FileResponse>(
        isOpen ? `/api/filesystem?path=${encodeURIComponent(requestedPath)}` : null,
        fetchJsonOrThrow,
        // A failed or in-flight navigation keeps showing the last good listing's path.
        { keepPreviousData: true, revalidateOnFocus: false }
    );

    const navigateUp = () => {
        if (data?.parent) {
            setRequestedPath(data.parent);
        }
    };

    const navigateTo = (path: string) => {
        setRequestedPath(path);
    };

    return {
        currentPath: data?.currentPath ?? requestedPath,
        data: data ?? null,
        loading: isLoading,
        error: error instanceof Error ? error.message : "",
        navigateUp,
        navigateTo
    };
}

import { useState, useEffect } from "react";

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
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [data, setData] = useState<FileResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchPath(initialPath || "");
        }
    }, [isOpen]);

    const fetchPath = async (path: string) => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/filesystem?path=${encodeURIComponent(path)}`);
            if (!res.ok) throw new Error("Failed to load directory");
            const json = await res.json();
            setData(json);
            setCurrentPath(json.currentPath);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const navigateUp = () => {
        if (data?.parent) {
            fetchPath(data.parent);
        }
    };

    const navigateTo = (path: string) => {
        fetchPath(path);
    };

    return {
        currentPath,
        data,
        loading,
        error,
        navigateUp,
        navigateTo
    };
}

export const SERVER_COLORS = [
    "#F87171", // red-400
    "#34D399", // emerald-400
    "#60A5FA", // blue-400
    "#A78BFA", // violet-400
    "#FBBF24", // amber-400
    "#FB7185", // rose-400
    "#2DD4BF", // teal-400
    "#C084FC", // purple-400
    "#818CF8", // indigo-400
    "#F472B6", // pink-400
];

export const getServerColor = (serverId: string | undefined, overrideColor?: string | null): string => {
    if (overrideColor) return overrideColor;
    if (!serverId) return "#94A3B8"; // slate-400 for unknown
    let hash = 0;
    for (let i = 0; i < serverId.length; i++) {
        hash = serverId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % SERVER_COLORS.length;
    return SERVER_COLORS[index];
};

/**
 * Settings nav labels are i18n keys ("settings.general"). When a key has no
 * translation, `t` echoes it back — show the Title-cased last segment instead
 * of the raw key.
 */
export const resolveNavLabel = (t: (key: string) => string, key: string): string => {
    const translated = t(key);
    if (translated !== key) return translated;
    const segment = key.split(".").pop() ?? key;
    return segment.charAt(0).toUpperCase() + segment.slice(1);
};

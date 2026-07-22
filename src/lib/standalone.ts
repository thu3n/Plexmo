/**
 * True when running as an installed PWA (iOS home-screen web app or any
 * display-mode: standalone context). SSR-safe. Used to branch flows that must
 * never navigate out of the manifest scope — iOS drops standalone mode the
 * moment a top-level/popup navigation leaves it.
 */
export const isStandaloneDisplayMode = (): boolean => {
    if (typeof window === "undefined") return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return (
        nav.standalone === true ||
        (typeof window.matchMedia === "function" &&
            window.matchMedia("(display-mode: standalone)").matches)
    );
};

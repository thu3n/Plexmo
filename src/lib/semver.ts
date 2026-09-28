/** Minimal SemVer handling for the About page's update check (no dependency needed). */

export type SemVer = { major: number; minor: number; patch: number; prerelease: string | null };

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export const parseSemver = (input: string): SemVer | null => {
  const m = SEMVER_RE.exec(input.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4] ?? null };
};

const comparePrerelease = (a: string | null, b: string | null): number => {
  // A release outranks any prerelease of the same version.
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const na = /^\d+$/.test(pa[i]) ? Number(pa[i]) : NaN;
    const nb = /^\d+$/.test(pb[i]) ? Number(pb[i]) : NaN;
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na !== nb) return na < nb ? -1 : 1;
    } else if (!Number.isNaN(na)) {
      return -1;
    } else if (!Number.isNaN(nb)) {
      return 1;
    } else if (pa[i] !== pb[i]) {
      return pa[i] < pb[i] ? -1 : 1;
    }
  }
  return 0;
};

/** -1 / 0 / 1 like a sort comparator; null when either side is not SemVer. */
export const compareSemver = (a: string, b: string): number | null => {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return null;
  for (const part of ["major", "minor", "patch"] as const) {
    if (va[part] !== vb[part]) return va[part] < vb[part] ? -1 : 1;
  }
  return comparePrerelease(va.prerelease, vb.prerelease);
};

/** True only when `latest` is a strictly newer valid SemVer than `current`. */
export const isNewerVersion = (latest: string, current: string): boolean => compareSemver(latest, current) === 1;

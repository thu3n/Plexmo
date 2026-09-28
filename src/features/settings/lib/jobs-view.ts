/** Pure helpers for Settings → Jobs: polling cadence, filtering, labels. */

export type JobStatus = "pending" | "running" | "completed" | "failed";

export type JobRecord = {
    id: string;
    type: string;
    status: JobStatus;
    progress: number;
    message?: string | null;
    createdAt: string;
    updatedAt: string;
};

/** Poll fast only while something is moving; otherwise the list is effectively static. */
export const JOBS_FAST_POLL_MS = 2000;
export const JOBS_SLOW_POLL_MS = 30_000;

export const isActiveJob = (job: Pick<JobRecord, "status">): boolean =>
    job.status === "pending" || job.status === "running";

export const selectJobsPollInterval = (jobs: readonly Pick<JobRecord, "status">[] | undefined): number =>
    jobs?.some(isActiveJob) ? JOBS_FAST_POLL_MS : JOBS_SLOW_POLL_MS;

export type JobStatusFilter = "all" | "active" | "completed" | "failed";

export const JOB_STATUS_FILTERS: { value: JobStatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Running" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
];

export const ALL_JOB_TYPES = "all";

const matchesStatus = (job: JobRecord, filter: JobStatusFilter): boolean => {
    if (filter === "all") return true;
    if (filter === "active") return isActiveJob(job);
    return job.status === filter;
};

export const filterJobs = (jobs: readonly JobRecord[], status: JobStatusFilter, type: string): JobRecord[] =>
    jobs.filter((job) => matchesStatus(job, status) && (type === ALL_JOB_TYPES || job.type === type));

export const jobTypesOf = (jobs: readonly JobRecord[]): string[] => Array.from(new Set(jobs.map((j) => j.type))).sort();

export const formatJobType = (type: string): string => {
    const text = type.replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
};

"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetchJsonOrThrow } from "@/lib/swr-fetch";
import { useFeedback } from "@/components/ui/Feedback";
import { JOBS_SLOW_POLL_MS, selectJobsPollInterval, type JobRecord } from "@/features/settings/lib/jobs-view";
import type { ScheduledTask } from "@/lib/scheduled-tasks";

const JOBS_URL = "/api/jobs";
const SCHEDULED_URL = "/api/jobs/scheduled";
const HTTP_CONFLICT = 409;

/**
 * Job history + recurring task schedule. Polling adapts to activity: 2s while a
 * job is pending/running so progress moves, slow otherwise.
 */
export function useJobs() {
    const { toast } = useFeedback();
    const jobs = useSWR<{ jobs: JobRecord[] }>(JOBS_URL, fetchJsonOrThrow, {
        refreshInterval: (latest) => selectJobsPollInterval(latest?.jobs),
    });
    const scheduled = useSWR<{ tasks: ScheduledTask[] }>(SCHEDULED_URL, fetchJsonOrThrow, {
        // Last/next run estimates drift slowly; the slow cadence is plenty.
        refreshInterval: JOBS_SLOW_POLL_MS,
    });
    const [triggering, setTriggering] = useState<string | null>(null);

    const { mutate: mutateJobs } = jobs;
    const { mutate: mutateScheduled } = scheduled;

    // Not requestJson: a 409 ("already running") is an expected outcome that
    // deserves an info toast, and requestJson doesn't expose the status.
    const runTask = useCallback(
        async (task: Pick<ScheduledTask, "id" | "name" | "runEndpoint">) => {
            if (!task.runEndpoint) return;
            setTriggering(task.id);
            try {
                const res = await fetch(task.runEndpoint, { method: "POST" });
                const body = (await res.json().catch(() => null)) as { error?: string } | null;
                if (res.status === HTTP_CONFLICT) {
                    toast(body?.error || `${task.name} is already running`, "info");
                } else if (!res.ok) {
                    toast(body?.error || `Failed to start ${task.name}`, "error");
                } else {
                    toast(`${task.name} started`);
                }
            } catch {
                toast(`Failed to start ${task.name}`, "error");
            } finally {
                setTriggering(null);
                await Promise.all([mutateJobs(), mutateScheduled()]);
            }
        },
        [toast, mutateJobs, mutateScheduled]
    );

    return {
        jobs: jobs.data?.jobs,
        jobsError: jobs.error,
        jobsLoading: jobs.isLoading,
        tasks: scheduled.data?.tasks,
        tasksError: scheduled.error,
        tasksLoading: scheduled.isLoading,
        triggering,
        runTask,
    };
}

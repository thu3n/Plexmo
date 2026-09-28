"use client";

import { SettingsSection } from "@/features/settings/components/ui/SettingsShell";
import { useLanguage } from "@/components/LanguageContext";
import { useJobs } from "@/features/settings/hooks/useJobs";
import { isActiveJob } from "@/features/settings/lib/jobs-view";
import { ScheduledTasksList } from "@/features/settings/components/jobs/ScheduledTasksList";
import { JobHistory } from "@/features/settings/components/jobs/JobHistory";

export default function JobsSettingsPage() {
    const { t } = useLanguage();
    const { jobs, jobsError, jobsLoading, tasks, tasksError, tasksLoading, triggering, runTask } = useJobs();

    const runningJobTypes = new Set((jobs ?? []).filter(isActiveJob).map((j) => j.type));

    return (
        <div className="space-y-12">
            <SettingsSection
                title={t("settings.jobs")}
                description="Recurring background tasks and job history."
                contentClassName="space-y-10"
            >
                <ScheduledTasksList
                    tasks={tasks}
                    isLoading={tasksLoading}
                    hasError={Boolean(tasksError)}
                    triggering={triggering}
                    runningJobTypes={runningJobTypes}
                    onRun={runTask}
                />
                <JobHistory jobs={jobs} isLoading={jobsLoading} hasError={Boolean(jobsError)} />
            </SettingsSection>
        </div>
    );
}

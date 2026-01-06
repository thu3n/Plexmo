import { db } from "./db";

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
    id: string;
    type: string;
    targetId?: string;
    status: JobStatus;
    progress: number;
    message?: string;
    itemsProcessed: number;
    totalItems: number;
    createdAt: string;
    updatedAt: string;
}

export const createJob = (type: string, targetId?: string): Job => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Check if running job exists for this target?
    // For now, let's just create a new one.

    const job: Job = {
        id,
        type,
        targetId,
        status: 'pending',
        progress: 0,
        message: 'Initialized',
        itemsProcessed: 0,
        totalItems: 0,
        createdAt: now,
        updatedAt: now
    };

    db.prepare(`
        INSERT INTO jobs (id, type, targetId, status, progress, message, itemsProcessed, totalItems, createdAt, updatedAt)
        VALUES (@id, @type, @targetId, @status, @progress, @message, @itemsProcessed, @totalItems, @createdAt, @updatedAt)
    `).run({
        ...job,
        targetId: targetId ?? null,
        message: job.message ?? null
    });

    return job;
};

export const updateJob = (id: string, updates: Partial<Omit<Job, 'id' | 'createdAt'>>) => {
    const fields = Object.keys(updates).map(key => `${key} = @${key}`).join(', ');
    if (!fields) return;

    const now = new Date().toISOString();

    db.prepare(`
        UPDATE jobs 
        SET ${fields}, updatedAt = @updatedAt
        WHERE id = @id
    `).run({
        ...updates,
        id,
        updatedAt: now,
        targetId: updates.targetId === undefined ? undefined : (updates.targetId ?? null),
        message: updates.message === undefined ? undefined : (updates.message ?? null)
    });
};

export const getJobs = (): Job[] => {
    return db.prepare("SELECT * FROM jobs ORDER BY createdAt DESC LIMIT 50").all() as Job[];
};

export const getJob = (id: string): Job | undefined => {
    return db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job | undefined;
};

export const getRunningJobForTarget = (type: string, targetId: string): Job | undefined => {
    return db.prepare("SELECT * FROM jobs WHERE type = ? AND targetId = ? AND status IN ('pending', 'running')").get(type, targetId) as Job | undefined;
};

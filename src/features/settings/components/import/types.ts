// Shared types for the Tautulli import wizard (settings/import page + steps).

export interface PlexmoServer {
    id: string;
    name: string;
    baseUrl: string;
    identifier?: string;
}

export interface TautulliServerInfo {
    id: string;
    name: string;
    identifier?: string;
    type: 'standard' | 'fork';
    param: string | number;
}

export interface Job {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    message?: string;
    itemsProcessed: number;
    totalItems: number;
}

export type ImportStep = 'connect' | 'source_select' | 'mapping' | 'importing' | 'completed';

export interface ImportStatus {
    success?: boolean;
    message?: string;
    error?: string;
}

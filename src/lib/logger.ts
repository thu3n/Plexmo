export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

const getCurrentLogLevel = (): number => {
    const level = (process.env.LOG_LEVEL?.toUpperCase() as LogLevel) || 'INFO';
    return LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
};

const formatMessage = (level: LogLevel, message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    // Error objects don't serialize via JSON.stringify (message/stack aren't
    // enumerable own properties). Surface them explicitly so logs stay useful.
    let metaString = '';
    if (meta instanceof Error) {
        metaString = ` ${meta.message}${meta.stack ? `\n${meta.stack}` : ''}`;
    } else if (meta !== undefined) {
        metaString = ` ${JSON.stringify(meta)}`;
    }
    return `[${timestamp}] [${level}] ${message}${metaString}`;
};

export const Logger = {
    debug: (message: string, meta?: any) => {
        if (getCurrentLogLevel() <= LOG_LEVELS.DEBUG) {
            console.debug(formatMessage('DEBUG', message, meta));
        }
    },
    info: (message: string, meta?: any) => {
        if (getCurrentLogLevel() <= LOG_LEVELS.INFO) {
            console.info(formatMessage('INFO', message, meta));
        }
    },
    warn: (message: string, meta?: any) => {
        if (getCurrentLogLevel() <= LOG_LEVELS.WARN) {
            console.warn(formatMessage('WARN', message, meta));
        }
    },
    error: (message: string, meta?: any) => {
        if (getCurrentLogLevel() <= LOG_LEVELS.ERROR) {
            console.error(formatMessage('ERROR', message, meta));
        }
    },
};

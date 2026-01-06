import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

interface VersionInfo {
    version: string;
    name: string;
    repository: {
        type: string;
        url: string;
    };
    buildDate: string;
}

let cachedVersionInfo: VersionInfo & { timestamp: number } | null = null;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export async function GET() {
    try {
        const now = Date.now();

        // Return cached version if still valid
        if (cachedVersionInfo && (now - cachedVersionInfo.timestamp) < CACHE_TTL) {
            const { timestamp, ...versionInfo } = cachedVersionInfo;
            return NextResponse.json(versionInfo);
        }

        // Read package.json
        const packageJsonPath = join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        const versionInfo: VersionInfo = {
            version: packageJson.version || '0.0.0',
            name: packageJson.name || 'plexmo',
            repository: packageJson.repository || {
                type: 'git',
                url: 'https://github.com/thu3n/plexmo.git'
            },
            buildDate: new Date().toISOString()
        };

        // Cache the result
        cachedVersionInfo = {
            ...versionInfo,
            timestamp: now
        };

        return NextResponse.json(versionInfo);
    } catch (error) {
        console.error('Error reading version info:', error);
        return NextResponse.json(
            {
                error: 'Failed to read version information',
                version: '0.0.0',
                name: 'plexmo',
                repository: {
                    type: 'git',
                    url: 'https://github.com/thu3n/plexmo.git'
                },
                buildDate: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

import { execFileSync } from 'node:child_process';
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    statSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';

import { build } from 'esbuild';


const BACKEND_ROOT = resolve(import.meta.dirname, '..');
const HANDLERS_DIR = resolve(BACKEND_ROOT, 'src/handlers');
const ASSETS_DIR = resolve(BACKEND_ROOT, 'assets');
const CA_BUNDLE_FILE = 'rds-ca-global-bundle.pem';
const DIST_DIR = resolve(BACKEND_ROOT, 'dist');

// Async pipeline handlers live in src/handlers/ alongside API handlers, but each
// deploys to its own CloudFormation stack (csep-dispatcher, csep-feedback, worker).
const ASYNC_BUNDLES = {
    dispatcher: { entry: 'dispatcher.ts', zipName: 'dispatcher.zip' },
    'event-handler': { entry: 'event-handler.ts', zipName: 'events.zip' },
    worker: { entry: 'worker.ts', zipName: 'worker.zip' },
};

const _collectApiEntries = () => {
    const asyncEntryFiles = new Set(Object.values(ASYNC_BUNDLES).map((item) => item.entry));
    return readdirSync(HANDLERS_DIR)
        .filter((name) => name.endsWith('.ts') && !asyncEntryFiles.has(name))
        .sort()
        .map((name) => resolve(HANDLERS_DIR, name));
};

const _bundleAndZip = async (bundleName, entryPoints, zipName) => {
    if (entryPoints.length === 0) {
        console.log(`Skipping ${bundleName}: no entry points found`);
        return null;
    }

    const stageDir = resolve(DIST_DIR, bundleName);
    const zipPath = resolve(DIST_DIR, zipName);

    rmSync(stageDir, { recursive: true, force: true });
    rmSync(zipPath, { force: true });
    mkdirSync(resolve(stageDir, 'assets'), { recursive: true });

    await build({
        entryPoints,
        outdir: stageDir,
        bundle: true,
        platform: 'node',
        target: 'node22',
        format: 'cjs',
        sourcemap: true,
        logLevel: 'warning',
    });

    // connection.ts resolves assets/rds-ca-global-bundle.pem relative to process.cwd() (/var/task).
    cpSync(
        resolve(ASSETS_DIR, CA_BUNDLE_FILE),
        resolve(stageDir, 'assets', CA_BUNDLE_FILE),
    );

    execFileSync('zip', ['-rq', zipPath, '.'], { cwd: stageDir });

    const sizeKb = (statSync(zipPath).size / 1024).toFixed(1);
    console.log(
        `Packaged ${bundleName} (${entryPoints.map((p) => basename(p)).length} handlers) -> dist/${zipName} (${sizeKb} KB)`,
    );
    return zipPath;
};

const _main = async () => {
    const requestedTarget = process.argv[2] ?? 'all';
    mkdirSync(DIST_DIR, { recursive: true });

    if (requestedTarget === 'all' || requestedTarget === 'api') {
        await _bundleAndZip('api', _collectApiEntries(), 'api.zip');
    }

    for (const [name, spec] of Object.entries(ASYNC_BUNDLES)) {
        if (requestedTarget !== 'all' && requestedTarget !== name) {
            continue;
        }
        const entryPath = resolve(HANDLERS_DIR, spec.entry);
        if (!existsSync(entryPath)) {
            if (requestedTarget === name) {
                throw new Error(`Handler entry not found: ${entryPath}`);
            }
            continue;
        }
        await _bundleAndZip(name, [entryPath], spec.zipName);
    }
};

_main().catch((err) => {
    console.error(err);
    process.exit(1);
});

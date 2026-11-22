import { cp, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist/event-handler/assets', { recursive: true });

await build({
    entryPoints: ['src/handlers/event-handler.ts'],
    bundle: true,
    platform: 'node',
    target: 'node24',
    outfile: 'dist/event-handler/event-handler.js',
});

await cp(
    'assets/rds-ca-global-bundle.pem',
    'dist/event-handler/assets/rds-ca-global-bundle.pem',
);

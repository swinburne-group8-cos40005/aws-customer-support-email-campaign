import { cp, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist/dispatcher/assets', { recursive: true });

await build({
    entryPoints: ['src/handlers/dispatcher.ts'],
    bundle: true,
    platform: 'node',
    target: 'node24',
    outfile: 'dist/dispatcher/dispatcher.js',
});

await cp(
    'assets/rds-ca-global-bundle.pem',
    'dist/dispatcher/assets/rds-ca-global-bundle.pem',
);

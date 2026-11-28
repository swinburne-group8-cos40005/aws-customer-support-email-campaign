import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir("dist/cognito-auth-trigger", { recursive: true });

await build({
    entryPoints: ["src/handlers/cognito-auth-trigger.ts"],
    bundle: true,
    platform: "node",
    target: "node24",
    outfile: "dist/cognito-auth-trigger/cognito-auth-trigger.js",
});

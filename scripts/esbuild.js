const esbuild = require('esbuild');

esbuild.build({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'target/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: false
}).catch(() => process.exit(1));

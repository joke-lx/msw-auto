import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    // TODO: 'cli/index' removed — CLI is being removed
    // 'cli/index': 'cli/index.js',
    'server/index': 'src/server/index.ts',
    'mcp/server': 'src/mcp/server.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'node18',
  outDir: './dist',
  splitting: false,
  sourcemap: true,
  dts: false,
  external: [
    'esbuild',
    'typescript',
    '@anthropic-ai/sdk',
    '@modelcontextprotocol/sdk',
    // TODO: @inquirer/*, chalk, ora, picocolors, yargs, cli-progress, clui removed — CLI is being removed
    // '@inquirer/*',
    // 'chalk',
    // 'ora',
    // 'picocolors',
    // 'yargs',
    'express',
    'cors',
    'ws',
    'better-sqlite3',
    // 'cli-progress',
    // 'clui',
  ],
})

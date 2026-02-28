#!/usr/bin/env node
import yargs from 'yargs'
import { init } from './init.js'
import { banner } from './banner.js'
import { server } from './commands/server.js'
import { web } from './commands/web.js'
import { generate } from './commands/generate.js'
import { importCmd } from './commands/import.js'

banner()

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
yargs(process.argv.slice(2))
  .usage('$0 <cmd> [args]')
  .command(
    'init',
    'Initializes Mock Service Worker at the specified directory',
    (yargs) => {
      yargs
        .positional('publicDir', {
          type: 'string',
          description: 'Relative path to the public directory',
          demandOption: false,
          normalize: true,
        })
        .option('save', {
          type: 'boolean',
          description: 'Save the worker directory in your package.json',
        })
        .option('cwd', {
          type: 'string',
          description: 'Custom current worker directory',
          normalize: true,
        })
        .example('$0 init')
        .example('$0 init ./public')
        .example('$0 init ./static --save')
    },
    init,
  )
  .command(
    'server',
    'Start the Mock server',
    (yargs) => {
      yargs
        .option('port', {
          type: 'number',
          description: 'Server port',
          default: 3001,
        })
        .option('watch', {
          type: 'boolean',
          description: 'Watch for changes',
          default: true,
        })
        .example('$0 server')
        .example('$0 server --port 8080')
    },
    server,
  )
  .command(
    'web',
    'Start the Web UI',
    (yargs) => {
      yargs
        .option('port', {
          type: 'number',
          description: 'Web UI port',
          default: 3000,
        })
        .example('$0 web')
        .example('$0 web --port 8080')
    },
    web,
  )
  .command(
    'generate',
    'Generate mock data using AI',
    (yargs) => {
      yargs
        .option('prompt', {
          type: 'string',
          description: 'Description of the mock data to generate',
          demandOption: true,
        })
        .option('output', {
          type: 'string',
          description: 'Output file path',
          default: './mocks/generated.ts',
        })
        .example('$0 generate --prompt "User list API"')
        .example('$0 generate -p "Product catalog" -o ./mocks/products.ts')
    },
    generate,
  )
  .command(
    'import',
    'Import API definitions from Postman/Swagger',
    (yargs) => {
      yargs
        .positional('file', {
          type: 'string',
          description: 'Path to Postman/Swagger file',
          demandOption: true,
        })
        .option('output', {
          type: 'string',
          description: 'Output directory',
          default: './mocks',
        })
        .example('$0 import ./api-spec.json')
        .example('$0 import ./swagger.yaml --output ./mocks')
    },
    importCmd,
  )
  .demandCommand()
  .help().argv

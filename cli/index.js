#!/usr/bin/env node
import yargs from 'yargs'
import { init } from './init.js'
import { banner } from './banner.js'
import { server } from './commands/server.js'
import { web } from './commands/web.js'
import { generate } from './commands/generate.js'
import { importCmd } from './commands/import.js'
import { menu, showHelp } from './menu.js'
import { configCmd, modelCmd, showConfig } from './commands/config.js'
import { setLanguage } from './i18n.js'

// Parse --lang option early
const langIndex = process.argv.indexOf('--lang')
if (langIndex !== -1 && process.argv[langIndex + 1]) {
  setLanguage(process.argv[langIndex + 1])
}

banner()

// Check if running in interactive mode (no arguments)
const isInteractive = process.argv.length === 2

if (isInteractive) {
  console.log('Starting in interactive mode...')
  console.log('Type "help" for available commands or press Enter to continue.\n')
  menu().catch(console.error)
  process.exit(0)
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
yargs(process.argv.slice(2))
  .usage('$0 <cmd> [args]')
  .option('lang', {
    alias: 'l',
    type: 'string',
    description: 'Language: en or zh',
    choices: ['en', 'zh'],
  })
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
  .command(
    'interactive',
    'Start interactive mode',
    () => {},
    async () => {
      await menu()
    },
  )
  .command(
    'config',
    'Show current configuration',
    () => {},
    async () => {
      await showConfig()
    },
  )
  .command(
    'setting',
    'Configure LLM settings (provider, baseUrl, apiKey)',
    (yargs) => {
      yargs
        .option('provider', {
          type: 'string',
          description: 'LLM provider (anthropic, openai, custom)',
          choices: ['anthropic', 'openai', 'custom'],
        })
        .option('baseurl', {
          type: 'string',
          description: 'API base URL (for custom provider)',
        })
        .option('apikey', {
          type: 'string',
          description: 'API key',
        })
        .example('$0 setting --provider openai')
        .example('$0 setting --apikey sk-xxx')
        .example('$0 setting --provider custom --baseurl https://api.example.com/v1')
    },
    async (argv) => {
      await configCmd(argv)
    },
  )
  .command(
    'model',
    'Switch LLM model',
    (yargs) => {
      yargs
        .positional('model', {
          type: 'string',
          description: 'Model name',
          demandOption: true,
        })
        .example('$0 model claude-3-5-sonnet-20241022')
        .example('$0 model gpt-4o')
    },
    async (argv) => {
      await modelCmd(argv.model)
    },
  )
  .command(
    'help',
    'Show help information',
    () => {},
    async () => {
      await showHelp()
    },
  )
  .demandCommand()
  .help().argv

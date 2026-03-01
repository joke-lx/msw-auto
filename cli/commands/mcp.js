import { success, error } from '../banner.js'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function mcp(argv) {
  try {
    success('Starting MCP Server...')

    // Find the project root
    const projectRoot = path.resolve(__dirname, '../..')

    // Start the MCP server
    const serverProcess = spawn('npx', ['tsx', 'src/mcp/server.ts'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
      },
    })

    serverProcess.on('error', (err) => {
      error(`Failed to start MCP Server: ${err.message}`)
      process.exit(1)
    })

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        error(`MCP Server exited with code ${code}`)
        process.exit(code || 1)
      }
    })
  } catch (err) {
    error(`Failed to start MCP Server: ${err.message}`)
    process.exit(1)
  }
}

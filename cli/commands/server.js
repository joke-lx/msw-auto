import { success, error } from '../banner.js'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function server(argv) {
  const port = argv.port || 3001

  try {
    success(`Starting Mock server on port ${port}...`)

    // Find the project root
    const projectRoot = path.resolve(__dirname, '../..')

    // Start the server using tsx
    const serverProcess = spawn('npx', ['tsx', 'src/server/index.ts'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    })

    serverProcess.on('error', (err) => {
      error(`Failed to start server: ${err.message}`)
      process.exit(1)
    })

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        error(`Server exited with code ${code}`)
        process.exit(code || 1)
      }
    })
  } catch (err) {
    error(`Failed to start server: ${err.message}`)
    process.exit(1)
  }
}

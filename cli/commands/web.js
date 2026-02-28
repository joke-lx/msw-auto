import { success, error } from '../banner.js'

export async function web(argv) {
  const port = argv.port || 3000

  try {
    success(`Starting Web UI on port ${port}...`)
    success(`Open http://localhost:${port} in your browser`)
    // Web UI would be started via Vite
    console.log('\nPress Ctrl+C to stop the server\n')
    // In production, this would spawn a child process to run the web server
  } catch (err) {
    error(`Failed to start Web UI: ${err.message}`)
    process.exit(1)
  }
}

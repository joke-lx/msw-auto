import pc from 'picocolors'

export function banner() {
  console.log(`
${pc.cyan('╔═══════════════════════════════════════════════════════════╗')}
${pc.cyan('║')}     ${pc.bold(pc.blue('MSW Auto'))} - Intelligent Mock Server                     ${pc.cyan('║')}
${pc.cyan('║')}     ${pc.dim('Version 2.12.10')}                                     ${pc.cyan('║')}
${pc.cyan('╚═══════════════════════════════════════════════════════════╝')}
${pc.dim('━'.repeat(62))}
`)
}

export function success(message) {
  console.log(`${pc.green('✓')} ${message}`)
}

export function error(message) {
  console.error(`${pc.red('✗')} ${message}`)
}

export function info(message) {
  console.log(`${pc.blue('ℹ')} ${message}`)
}

export function warn(message) {
  console.log(`${pc.yellow('⚠')} ${message}`)
}

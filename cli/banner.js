import pc from 'picocolors'
import { t, getCurrentLang } from './i18n.js'

export function banner() {
  const lang = getCurrentLang()
  const version = process.env.MSW_AUTO_VERSION || '2.12.11'

  console.log(`
${pc.cyan('╔═══════════════════════════════════════════════════════════╗')}
${pc.cyan('║')}     ${pc.bold(pc.blue(t('banner.title')))} - ${t('banner.subtitle')}                     ${pc.cyan('║')}
${pc.cyan('║')}     ${pc.dim('Version ' + version)}                                     ${pc.cyan('║')}
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

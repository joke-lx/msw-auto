/**
 * Monorepo 工作区检测工具
 * 支持 pnpm workspaces, yarn workspaces, lerna
 */

import * as fs from 'fs'
import * as path from 'path'

export interface MonorepoInfo {
  type: 'pnpm' | 'yarn' | 'lerna' | null
  root: string
  packages: string[]
}

export class MonorepoDetector {
  /**
   * 检测是否为 monorepo 并返回所有包路径
   */
  detect(rootPath: string): MonorepoInfo {
    // 1. 检测 pnpm workspaces
    const pnpmInfo = this.detectPnpmWorkspaces(rootPath)
    if (pnpmInfo) return pnpmInfo

    // 2. 检测 yarn workspaces
    const yarnInfo = this.detectYarnWorkspaces(rootPath)
    if (yarnInfo) return yarnInfo

    // 3. 检测 lerna
    const lernaInfo = this.detectLerna(rootPath)
    if (lernaInfo) return lernaInfo

    // 不是 monorepo
    return {
      type: null,
      root: rootPath,
      packages: [],
    }
  }

  /**
   * 检测 pnpm workspaces
   */
  private detectPnpmWorkspaces(rootPath: string): MonorepoInfo | null {
    const workspaceFile = path.join(rootPath, 'pnpm-workspace.yaml')

    if (fs.existsSync(workspaceFile)) {
      try {
        const content = fs.readFileSync(workspaceFile, 'utf-8')
        const packages = this.parsePnpmWorkspace(content, rootPath)

        if (packages.length > 0) {
          return {
            type: 'pnpm',
            root: rootPath,
            packages,
          }
        }
      } catch {
        // 解析失败
      }
    }

    return null
  }

  /**
   * 解析 pnpm-workspace.yaml
   * 格式:
   * packages:
   *   - 'packages/*'
   *   - 'apps/*'
   */
  private parsePnpmWorkspace(content: string, rootPath: string): string[] {
    const packages: string[] = []
    const lines = content.split('\n')

    let inPackages = false

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed === 'packages:') {
        inPackages = true
        continue
      }

      if (inPackages) {
        if (line.startsWith(' ') || line.startsWith('\t')) {
          // 继续收集包路径
          const packagePath = trimmed.replace(/['"]/g, '')
          if (packagePath && !packagePath.startsWith('#')) {
            const fullPath = path.join(rootPath, packagePath)
            if (fs.existsSync(fullPath)) {
              packages.push(fullPath)
            }
          }
        } else if (trimmed && !trimmed.startsWith('#')) {
          // 新的顶级配置
          break
        }
      }
    }

    return packages
  }

  /**
   * 检测 yarn workspaces
   */
  private detectYarnWorkspaces(rootPath: string): MonorepoInfo | null {
    const packageJsonPath = path.join(rootPath, 'package.json')

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

        if (packageJson.workspaces) {
          let workspaces: string[]

          if (Array.isArray(packageJson.workspaces)) {
            // yarn 2+ 格式: workspaces: ['packages/*', 'apps/*']
            workspaces = packageJson.workspaces
          } else if (packageJson.workspaces.packages) {
            // yarn 1 格式: workspaces: { packages: ['packages/*', 'apps/*'] }
            workspaces = packageJson.workspaces.packages
          } else {
            return null
          }

          const packages: string[] = []

          for (const workspace of workspaces) {
            // 支持 glob pattern
            const pattern = workspace.replace(/\/\*$/, '')
            const fullPath = path.join(rootPath, pattern)

            if (fs.existsSync(fullPath)) {
              // 如果是目录，可能是 glob，需要展开
              if (this.isGlobPattern(workspace)) {
                packages.push(...this.expandGlob(fullPath))
              } else {
                packages.push(fullPath)
              }
            }
          }

          if (packages.length > 0) {
            return {
              type: 'yarn',
              root: rootPath,
              packages,
            }
          }
        }
      } catch {
        // 解析失败
      }
    }

    return null
  }

  /**
   * 检测 lerna
   */
  private detectLerna(rootPath: string): MonorepoInfo | null {
    const lernaConfigPath = path.join(rootPath, 'lerna.json')

    if (fs.existsSync(lernaConfigPath)) {
      try {
        const lernaConfig = JSON.parse(fs.readFileSync(lernaConfigPath, 'utf-8'))
        const packagesDir = lernaConfig.packages || ['packages']

        const packages: string[] = []

        for (const pkgDir of packagesDir) {
          const fullPath = path.join(rootPath, pkgDir)

          if (fs.existsSync(fullPath)) {
            if (this.isGlobPattern(pkgDir)) {
              packages.push(...this.expandGlob(fullPath))
            } else {
              packages.push(fullPath)
            }
          }
        }

        if (packages.length > 0) {
          return {
            type: 'lerna',
            root: rootPath,
            packages,
          }
        }
      } catch {
        // 解析失败
      }
    }

    return null
  }

  /**
   * 判断是否为 glob pattern
   */
  private isGlobPattern(pattern: string): boolean {
    return pattern.includes('*')
  }

  /**
   * 展开 glob pattern
   */
  private expandGlob(globPath: string): string[] {
    const packages: string[] = []

    try {
      const entries = fs.readdirSync(globPath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          packages.push(path.join(globPath, entry.name))
        }
      }
    } catch {
      // 目录不存在或无法读取
    }

    return packages
  }
}

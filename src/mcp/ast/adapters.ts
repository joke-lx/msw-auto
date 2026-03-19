/**
 * 框架适配器
 * 为不同框架提供统一的路由提取接口
 */

import { ASTEngine, type RouteDefinition } from './engine.js'
import * as fs from 'fs'
import * as path from 'path'

export interface FrameworkAdapter {
  name: string
  detect(projectPath: string): boolean
  analyze(projectPath: string): Promise<RouteDefinition[]>
}

/**
 * Express 适配器
 */
export class ExpressAdapter implements FrameworkAdapter {
  name = 'express'

  detect(projectPath: string): boolean {
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) return false

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    return !!(packageJson.dependencies?.express || packageJson.devDependencies?.express)
  }

  async analyze(projectPath: string): Promise<RouteDefinition[]> {
    const engine = new ASTEngine()
    const routes: RouteDefinition[] = []

    // 查找路由文件
    const routeFiles = this.findRouteFiles(projectPath, [
      '**/routes/**/*.{js,ts}',
      '**/router/**/*.{js,ts}',
      '**/api/**/*.{js,ts}',
      'app.{js,ts}',
      'server.{js,ts}',
    ])

    for (const file of routeFiles) {
      const result = await engine.analyzeFile(file)
      routes.push(...result.routes)
    }

    return routes
  }

  private findRouteFiles(projectPath: string, patterns: string[]): string[] {
    const files: string[] = []
    const glob = require('glob')

    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        cwd: projectPath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      })
      files.push(...matches)
    }

    return files
  }
}

/**
 * Next.js 适配器
 */
export class NextJsAdapter implements FrameworkAdapter {
  name = 'nextjs'

  detect(projectPath: string): boolean {
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) return false

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    return !!(packageJson.dependencies?.next || packageJson.devDependencies?.next)
  }

  async analyze(projectPath: string): Promise<RouteDefinition[]> {
    const engine = new ASTEngine()
    const routes: RouteDefinition[] = []

    // Next.js API routes 在 pages/api 或 app/api
    const apiDirs = [
      path.join(projectPath, 'pages', 'api'),
      path.join(projectPath, 'src', 'pages', 'api'),
      path.join(projectPath, 'app', 'api'),
      path.join(projectPath, 'src', 'app', 'api'),
    ]

    for (const apiDir of apiDirs) {
      if (fs.existsSync(apiDir)) {
        const files = this.findApiFiles(apiDir)
        for (const file of files) {
          const result = await engine.analyzeFile(file)
          routes.push(...result.routes)
        }
      }
    }

    return routes
  }

  private findApiFiles(dir: string): string[] {
    const files: string[] = []

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
          files.push(fullPath)
        }
      }
    }

    walk(dir)
    return files
  }
}

/**
 * NestJS 适配器
 */
export class NestJsAdapter implements FrameworkAdapter {
  name = 'nestjs'

  detect(projectPath: string): boolean {
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) return false

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    return !!(packageJson.dependencies?.['@nestjs/common'] || packageJson.devDependencies?.['@nestjs/common'])
  }

  async analyze(projectPath: string): Promise<RouteDefinition[]> {
    const engine = new ASTEngine()
    const routes: RouteDefinition[] = []

    // 查找 controller 文件
    const glob = require('glob')
    const controllerFiles = glob.sync('**/*.controller.{ts,js}', {
      cwd: projectPath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    })

    for (const file of controllerFiles) {
      const result = await engine.analyzeFile(file)
      routes.push(...result.routes)
    }

    return routes
  }
}

/**
 * Fastify 适配器
 */
export class FastifyAdapter implements FrameworkAdapter {
  name = 'fastify'

  detect(projectPath: string): boolean {
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) return false

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    return !!(packageJson.dependencies?.fastify || packageJson.devDependencies?.fastify)
  }

  async analyze(projectPath: string): Promise<RouteDefinition[]> {
    const engine = new ASTEngine()
    const routes: RouteDefinition[] = []

    const glob = require('glob')
    const routeFiles = glob.sync('**/{routes,router,api}/**/*.{js,ts}', {
      cwd: projectPath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    })

    for (const file of routeFiles) {
      const result = await engine.analyzeFile(file)
      routes.push(...result.routes)
    }

    return routes
  }
}

/**
 * 适配器管理器
 */
export class AdapterManager {
  private adapters: FrameworkAdapter[] = [
    new ExpressAdapter(),
    new NextJsAdapter(),
    new NestJsAdapter(),
    new FastifyAdapter(),
  ]

  /**
   * 检测项目使用的框架
   */
  detectFramework(projectPath: string): FrameworkAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.detect(projectPath)) {
        return adapter
      }
    }
    return null
  }

  /**
   * 分析项目路由
   */
  async analyzeProject(projectPath: string): Promise<RouteDefinition[]> {
    const adapter = this.detectFramework(projectPath)

    if (!adapter) {
      console.warn('No supported framework detected')
      return []
    }

    console.log(`Detected framework: ${adapter.name}`)
    return adapter.analyze(projectPath)
  }
}

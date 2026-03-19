/**
 * AST 解析引擎
 * 使用 Babel 解析 JavaScript/TypeScript 代码，提取路由定义
 */

import * as parser from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import * as fs from 'fs'
import * as path from 'path'

export interface RouteDefinition {
  method: string
  path: string
  handler?: string
  file: string
  line: number
  framework: string
}

export interface AnalysisResult {
  routes: RouteDefinition[]
  framework: string
  errors: string[]
}

export class ASTEngine {
  private variableValues: Map<string, any> = new Map()

  /**
   * 分析文件提取路由
   */
  async analyzeFile(filePath: string): Promise<AnalysisResult> {
    const errors: string[] = []
    const routes: RouteDefinition[] = []

    try {
      const code = fs.readFileSync(filePath, 'utf-8')
      const framework = this.detectFramework(code, filePath)

      if (!framework) {
        return { routes: [], framework: 'unknown', errors: [] }
      }

      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'dynamicImport',
        ],
      })

      // 第一遍：收集变量值
      this.collectVariables(ast)

      // 第二遍：提取路由
      const extractedRoutes = this.extractRoutes(ast, framework, filePath)
      routes.push(...extractedRoutes)

      return { routes, framework, errors }
    } catch (error) {
      errors.push(`Parse error in ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
      return { routes: [], framework: 'unknown', errors }
    }
  }

  /**
   * 检测框架类型
   */
  private detectFramework(code: string, filePath: string): string | null {
    // Next.js API routes
    if (filePath.includes('/pages/api/') || filePath.includes('\\pages\\api\\')) {
      return 'nextjs'
    }

    // 检查 import 语句
    if (code.includes('from \'express\'') || code.includes('from "express"')) {
      return 'express'
    }
    if (code.includes('from \'fastify\'') || code.includes('from "fastify"')) {
      return 'fastify'
    }
    if (code.includes('from \'koa\'') || code.includes('from "koa"')) {
      return 'koa'
    }
    if (code.includes('@nestjs/common')) {
      return 'nestjs'
    }

    return null
  }

  /**
   * 收集变量值（常量折叠）
   */
  private collectVariables(ast: any) {
    this.variableValues.clear()

    traverse(ast, {
      VariableDeclarator: (path) => {
        const { id, init } = path.node

        if (t.isIdentifier(id) && init) {
          const value = this.evaluateExpression(init)
          if (value !== undefined) {
            this.variableValues.set(id.name, value)
          }
        }
      },
    })
  }

  /**
   * 提取路由定义
   */
  private extractRoutes(ast: any, framework: string, filePath: string): RouteDefinition[] {
    const routes: RouteDefinition[] = []

    traverse(ast, {
      // Express/Fastify/Koa: router.get('/path', handler)
      CallExpression: (path) => {
        if (framework === 'express' || framework === 'fastify' || framework === 'koa') {
          const route = this.extractCallExpressionRoute(path, framework, filePath)
          if (route) routes.push(route)
        }
      },

      // NestJS: @Get('/path')
      Decorator: (path) => {
        if (framework === 'nestjs') {
          const route = this.extractDecoratorRoute(path, filePath)
          if (route) routes.push(route)
        }
      },

      // Next.js: export default function handler(req, res) {}
      ExportDefaultDeclaration: (path) => {
        if (framework === 'nextjs') {
          const route = this.extractNextJsRoute(path, filePath)
          if (route) routes.push(route)
        }
      },
    })

    return routes
  }

  /**
   * 提取 CallExpression 路由 (Express/Fastify/Koa)
   */
  private extractCallExpressionRoute(
    path: any,
    framework: string,
    filePath: string
  ): RouteDefinition | null {
    const { node } = path
    const { callee, arguments: args } = node

    // router.get(...) 或 app.get(...)
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      const method = callee.property.name.toLowerCase()
      const validMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']

      if (validMethods.includes(method) && args.length >= 1) {
        const routePath = this.evaluateExpression(args[0])

        if (typeof routePath === 'string') {
          return {
            method: method === 'all' ? 'ALL' : method.toUpperCase(),
            path: routePath,
            handler: this.extractHandlerName(args[1]),
            file: filePath,
            line: node.loc?.start.line || 0,
            framework,
          }
        }
      }
    }

    return null
  }

  /**
   * 提取 Decorator 路由 (NestJS)
   */
  private extractDecoratorRoute(path: any, filePath: string): RouteDefinition | null {
    const { node } = path

    if (t.isDecorator(node) && t.isCallExpression(node.expression)) {
      const { callee, arguments: args } = node.expression

      if (t.isIdentifier(callee)) {
        const decoratorName = callee.name
        const methodMap: Record<string, string> = {
          Get: 'GET',
          Post: 'POST',
          Put: 'PUT',
          Patch: 'PATCH',
          Delete: 'DELETE',
          Options: 'OPTIONS',
          Head: 'HEAD',
        }

        const method = methodMap[decoratorName]
        if (method && args.length >= 1) {
          const routePath = this.evaluateExpression(args[0])

          if (typeof routePath === 'string') {
            return {
              method,
              path: routePath,
              file: filePath,
              line: node.loc?.start.line || 0,
              framework: 'nestjs',
            }
          }
        }
      }
    }

    return null
  }

  /**
   * 提取 Next.js 路由
   */
  private extractNextJsRoute(path: any, filePath: string): RouteDefinition | null {
    // Next.js API 路由从文件路径推断
    const apiMatch = filePath.match(/pages[\/\\]api[\/\\](.+)\.(ts|js|tsx|jsx)$/)

    if (apiMatch) {
      let routePath = '/' + apiMatch[1].replace(/\\/g, '/')

      // 处��动态路由: [id].ts -> :id
      routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1')

      // 处理 catch-all: [...slug].ts -> *
      routePath = routePath.replace(/\.\.\./g, '*')

      return {
        method: 'ALL', // Next.js API routes handle all methods
        path: `/api${routePath}`,
        file: filePath,
        line: 1,
        framework: 'nextjs',
      }
    }

    return null
  }

  /**
   * 求值表达式（常量折叠）
   */
  private evaluateExpression(node: any): any {
    if (t.isStringLiteral(node)) {
      return node.value
    }

    if (t.isNumericLiteral(node)) {
      return node.value
    }

    if (t.isBooleanLiteral(node)) {
      return node.value
    }

    if (t.isTemplateLiteral(node)) {
      // 简单模板字符串
      if (node.expressions.length === 0) {
        return node.quasis[0].value.cooked
      }
      // 复杂模板字符串，尝试拼接
      let result = ''
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.cooked
        if (i < node.expressions.length) {
          const exprValue = this.evaluateExpression(node.expressions[i])
          result += exprValue !== undefined ? String(exprValue) : '${...}'
        }
      }
      return result
    }

    if (t.isIdentifier(node)) {
      return this.variableValues.get(node.name)
    }

    if (t.isBinaryExpression(node) && node.operator === '+') {
      const left = this.evaluateExpression(node.left)
      const right = this.evaluateExpression(node.right)
      if (left !== undefined && right !== undefined) {
        return String(left) + String(right)
      }
    }

    return undefined
  }

  /**
   * 提取处理函数名称
   */
  private extractHandlerName(node: any): string | undefined {
    if (t.isIdentifier(node)) {
      return node.name
    }

    if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
      return 'anonymous'
    }

    return undefined
  }
}

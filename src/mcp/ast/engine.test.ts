/**
 * AST 引擎集成测试
 */

import { describe, it, expect } from 'vitest'
import { ASTEngine } from './engine.js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('AST Engine Integration', () => {
  it('should extract Express routes', async () => {
    // 创建临时测试文件
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-test-'))
    const testFile = path.join(tmpDir, 'routes.js')

    fs.writeFileSync(testFile, `
      const express = require('express');
      const router = express.Router();

      router.get('/users', (req, res) => {
        res.json({ users: [] });
      });

      router.post('/users', (req, res) => {
        res.json({ created: true });
      });

      module.exports = router;
    `)

    const engine = new ASTEngine()
    const result = await engine.analyzeFile(testFile)

    expect(result.routes).toHaveLength(2)
    expect(result.routes[0].method).toBe('GET')
    expect(result.routes[0].path).toBe('/users')
    expect(result.routes[1].method).toBe('POST')
    expect(result.routes[1].path).toBe('/users')

    // 清理
    fs.unlinkSync(testFile)
    fs.rmdirSync(tmpDir)
  })

  it('should handle variable references', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-test-'))
    const testFile = path.join(tmpDir, 'routes.js')

    fs.writeFileSync(testFile, `
      const express = require('express');
      const router = express.Router();

      const API_PREFIX = '/api/v1';

      router.get(API_PREFIX + '/products', (req, res) => {
        res.json({ products: [] });
      });

      module.exports = router;
    `)

    const engine = new ASTEngine()
    const result = await engine.analyzeFile(testFile)

    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].path).toBe('/api/v1/products')

    // 清理
    fs.unlinkSync(testFile)
    fs.rmdirSync(tmpDir)
  })

  it('should handle template literals', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-test-'))
    const testFile = path.join(tmpDir, 'routes.js')

    fs.writeFileSync(testFile, `
      const express = require('express');
      const router = express.Router();

      const version = 'v2';

      router.get(\`/api/\${version}/items\`, (req, res) => {
        res.json({ items: [] });
      });

      module.exports = router;
    `)

    const engine = new ASTEngine()
    const result = await engine.analyzeFile(testFile)

    expect(result.routes).toHaveLength(1)
    expect(result.routes[0].path).toBe('/api/v2/items')

    // 清理
    fs.unlinkSync(testFile)
    fs.rmdirSync(tmpDir)
  })

  it('should extract NestJS decorator routes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-test-'))
    const testFile = path.join(tmpDir, 'users.controller.ts')

    fs.writeFileSync(testFile, `
      import { Controller, Get, Post } from '@nestjs/common';

      @Controller('users')
      export class UsersController {
        @Get()
        findAll() {
          return [];
        }

        @Get(':id')
        findOne() {
          return {};
        }

        @Post()
        create() {
          return { created: true };
        }
      }
    `)

    const engine = new ASTEngine()
    const result = await engine.analyzeFile(testFile)

    expect(result.routes.length).toBeGreaterThan(0)
    expect(result.framework).toBe('nestjs')

    // 清理
    fs.unlinkSync(testFile)
    fs.rmdirSync(tmpDir)
  })
})

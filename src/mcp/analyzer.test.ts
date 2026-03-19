/**
 * Analyzer 集成测试
 */

import { describe, it, expect } from 'vitest'
import { analyzeProject } from './analyzer.js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('Analyzer Integration', () => {
  it('should analyze Express project', async () => {
    // 创建临时项目
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer-test-'))

    // 创建 package.json
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      dependencies: {
        express: '^4.18.0'
      }
    }))

    // 创建路由文件
    const routesDir = path.join(tmpDir, 'routes')
    fs.mkdirSync(routesDir)
    fs.writeFileSync(path.join(routesDir, 'users.js'), `
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

    const result = await analyzeProject(tmpDir)

    expect(result.endpoints.length).toBeGreaterThan(0)
    expect(result.frameworks).toContain('express')
    expect(result.summary).toContain('API endpoints')

    // 清理
    fs.unlinkSync(path.join(routesDir, 'users.js'))
    fs.rmdirSync(routesDir)
    fs.unlinkSync(path.join(tmpDir, 'package.json'))
    fs.rmdirSync(tmpDir)
  })

  it('should analyze Next.js project', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer-test-'))

    // 创建 package.json
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'test-nextjs',
      dependencies: {
        next: '^14.0.0'
      }
    }))

    // 创建 pages/api 目录
    const pagesDir = path.join(tmpDir, 'pages')
    const apiDir = path.join(pagesDir, 'api')
    fs.mkdirSync(pagesDir)
    fs.mkdirSync(apiDir)

    fs.writeFileSync(path.join(apiDir, 'hello.ts'), `
      export default function handler(req, res) {
        res.status(200).json({ message: 'Hello' });
      }
    `)

    const result = await analyzeProject(tmpDir)

    expect(result.endpoints.length).toBeGreaterThan(0)
    expect(result.frameworks).toContain('nextjs')

    // 清理
    fs.unlinkSync(path.join(apiDir, 'hello.ts'))
    fs.rmdirSync(apiDir)
    fs.rmdirSync(pagesDir)
    fs.unlinkSync(path.join(tmpDir, 'package.json'))
    fs.rmdirSync(tmpDir)
  })

  it('should handle empty project', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer-test-'))

    const result = await analyzeProject(tmpDir)

    expect(result.endpoints).toHaveLength(0)
    expect(result.frameworks).toHaveLength(0)

    // 清理
    fs.rmdirSync(tmpDir)
  })
})

import fs from 'fs'
import path from 'path'
import type { Mock } from '../mock/manager.js'
import type { MockVersion } from '../mock/version-manager.js'

// 内存存储 - 充当 SQLite 的后备
class InMemoryStorage {
  private mocks: Map<string, Mock> = new Map()
  private versions: Map<string, MockVersion[]> = new Map()
  private requestLogs: any[] = []

  // Mock 操作
  async getAllMocks(): Promise<Mock[]> {
    return Array.from(this.mocks.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  async getMockById(id: string): Promise<Mock | null> {
    return this.mocks.get(id) || null
  }

  async saveMock(mock: Mock): Promise<void> {
    this.mocks.set(mock.id, mock)
  }

  async updateMock(mock: Mock): Promise<void> {
    this.mocks.set(mock.id, mock)
  }

  async deleteMock(id: string): Promise<void> {
    this.mocks.delete(id)
    this.versions.delete(id)
  }

  // Version 操作
  async saveMockVersion(version: MockVersion): Promise<void> {
    const existing = this.versions.get(version.mock_id) || []
    existing.push(version)
    this.versions.set(version.mock_id, existing)
  }

  async getMockVersions(mockId: string): Promise<MockVersion[]> {
    return (this.versions.get(mockId) || []).sort((a, b) => b.version - a.version)
  }

  async getMockVersion(mockId: string, version: number): Promise<MockVersion | null> {
    const versions = this.versions.get(mockId) || []
    return versions.find(v => v.version === version) || null
  }

  async deleteMockVersion(id: string): Promise<void> {
    for (const [mockId, versions] of this.versions) {
      this.versions.set(mockId, versions.filter(v => v.id !== id))
    }
  }

  // Request log 操作
  async saveRequestLog(log: any): Promise<void> {
    this.requestLogs.unshift(log)
    if (this.requestLogs.length > 1000) {
      this.requestLogs = this.requestLogs.slice(0, 1000)
    }
  }

  async getRecentRequests(limit: number): Promise<any[]> {
    return this.requestLogs.slice(0, limit)
  }
}

export class Database {
  private db: any = null
  private dbPath: string
  private memory: InMemoryStorage
  private useMemory = false

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.memory = new InMemoryStorage()
  }

  async connect(): Promise<void> {
    try {
      // 动态导入 better-sqlite3
      const Database = (await import('better-sqlite3')).default

      const dir = path.dirname(this.dbPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')
      this.initSchema()
      console.log('[Database] Connected to SQLite')
    } catch (error) {
      console.warn('[Database] Using in-memory storage (SQLite not available)')
      this.useMemory = true
      this.db = null
    }
  }

  private initSchema(): void {
    if (!this.db) return
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mocks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER DEFAULT 200,
        response TEXT NOT NULL,
        headers TEXT,
        cookies TEXT,
        delay INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        description TEXT,
        tags TEXT,
        version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS request_logs (
        id TEXT PRIMARY KEY,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        query TEXT,
        headers TEXT,
        body TEXT,
        response_status INTEGER,
        response_body TEXT,
        response_time INTEGER,
        is_mocked INTEGER DEFAULT 0,
        mock_id TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mock_versions (
        id TEXT PRIMARY KEY,
        mock_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        response TEXT NOT NULL,
        headers TEXT,
        description TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_mocks_method_path ON mocks(method, path);
      CREATE INDEX IF NOT EXISTS idx_mocks_enabled ON mocks(enabled);
      CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_mock_versions_mock_id ON mock_versions(mock_id, version DESC);
    `)
  }

  // ============ Mock Operations ============

  async getAllMocks(): Promise<Mock[]> {
    if (this.useMemory) return this.memory.getAllMocks()
    try {
      const rows = this.db.prepare('SELECT * FROM mocks ORDER BY created_at DESC').all()
      return rows.map(this.mapRowToMock)
    } catch { return [] }
  }

  async getMockById(id: string): Promise<Mock | null> {
    if (this.useMemory) return this.memory.getMockById(id)
    try {
      const row = this.db.prepare('SELECT * FROM mocks WHERE id = ?').get(id)
      return row ? this.mapRowToMock(row) : null
    } catch { return null }
  }

  async saveMock(mock: Mock): Promise<void> {
    if (this.useMemory) return this.memory.saveMock(mock)
    try {
      const stmt = this.db.prepare(`
        INSERT INTO mocks (id, name, method, path, status, response, headers, cookies, delay, enabled, description, tags, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        mock.id, mock.name, mock.method, mock.path, mock.status,
        JSON.stringify(mock.response),
        mock.headers ? JSON.stringify(mock.headers) : null,
        mock.cookies ? JSON.stringify(mock.cookies) : null,
        mock.delay || 0, mock.enabled ? 1 : 0,
        mock.description || null,
        mock.tags ? mock.tags.join(',') : null,
        mock.version, mock.created_at, mock.updated_at
      )
    } catch {}
  }

  async updateMock(mock: Mock): Promise<void> {
    if (this.useMemory) return this.memory.updateMock(mock)
    try {
      const stmt = this.db.prepare(`
        UPDATE mocks SET name = ?, method = ?, path = ?, status = ?, response = ?,
        headers = ?, cookies = ?, delay = ?, enabled = ?,
        description = ?, tags = ?, version = ?, updated_at = ?
        WHERE id = ?
      `)
      stmt.run(
        mock.name, mock.method, mock.path, mock.status,
        JSON.stringify(mock.response),
        mock.headers ? JSON.stringify(mock.headers) : null,
        mock.cookies ? JSON.stringify(mock.cookies) : null,
        mock.delay || 0, mock.enabled ? 1 : 0,
        mock.description || null,
        mock.tags ? mock.tags.join(',') : null,
        mock.version, mock.updated_at, mock.id
      )
    } catch {}
  }

  async deleteMock(id: string): Promise<void> {
    if (this.useMemory) return this.memory.deleteMock(id)
    try {
      this.db.prepare('DELETE FROM mock_versions WHERE mock_id = ?').run(id)
      this.db.prepare('DELETE FROM mocks WHERE id = ?').run(id)
    } catch {}
  }

  // ============ Version Operations ============

  async saveMockVersion(version: MockVersion): Promise<void> {
    if (this.useMemory) return this.memory.saveMockVersion(version)
    try {
      const stmt = this.db.prepare(`
        INSERT INTO mock_versions (id, mock_id, version, response, headers, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        version.id, version.mock_id, version.version,
        JSON.stringify(version.response),
        version.headers ? JSON.stringify(version.headers) : null,
        version.description || null, version.created_at
      )
    } catch {}
  }

  async getMockVersions(mockId: string): Promise<MockVersion[]> {
    if (this.useMemory) return this.memory.getMockVersions(mockId)
    try {
      const rows = this.db.prepare('SELECT * FROM mock_versions WHERE mock_id = ? ORDER BY version DESC').all(mockId)
      return rows.map((row: any) => ({
        id: row.id, mock_id: row.mock_id, version: row.version,
        response: JSON.parse(row.response),
        headers: row.headers ? JSON.parse(row.headers) : undefined,
        description: row.description, created_at: row.created_at
      }))
    } catch { return [] }
  }

  async getMockVersion(mockId: string, version: number): Promise<MockVersion | null> {
    if (this.useMemory) return this.memory.getMockVersion(mockId, version)
    try {
      const row = this.db.prepare('SELECT * FROM mock_versions WHERE mock_id = ? AND version = ?').get(mockId, version)
      if (!row) return null
      return {
        id: row.id, mock_id: row.mock_id, version: row.version,
        response: JSON.parse(row.response),
        headers: row.headers ? JSON.parse(row.headers) : undefined,
        description: row.description, created_at: row.created_at
      }
    } catch { return null }
  }

  async deleteMockVersion(id: string): Promise<void> {
    if (this.useMemory) return this.memory.deleteMockVersion(id)
    try { this.db.prepare('DELETE FROM mock_versions WHERE id = ?').run(id) } catch {}
  }

  // ============ Request Log Operations ============

  async saveRequestLog(log: any): Promise<void> {
    if (this.useMemory) return this.memory.saveRequestLog(log)
    try {
      const stmt = this.db.prepare(`
        INSERT INTO request_logs (id, method, path, query, headers, body, response_status, response_body, response_time, is_mocked, mock_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        log.id, log.method, log.path,
        log.query ? JSON.stringify(log.query) : null,
        log.headers ? JSON.stringify(log.headers) : null,
        log.body ? JSON.stringify(log.body) : null,
        log.response_status,
        log.response_body ? JSON.stringify(log.response_body) : null,
        log.response_time,
        log.is_mocked ? 1 : 0,
        log.mock_id || null, log.timestamp
      )
    } catch {}
  }

  async getRecentRequests(limit = 100): Promise<any[]> {
    if (this.useMemory) return this.memory.getRecentRequests(limit)
    try {
      const rows = this.db.prepare('SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT ?').all(limit)
      return rows.map((row: any) => ({
        ...row,
        headers: row.headers ? JSON.parse(row.headers) : null,
        query: row.query ? JSON.parse(row.query) : null,
        body: row.body ? JSON.parse(row.body) : null,
        response_body: row.response_body ? JSON.parse(row.response_body) : null,
        is_mocked: row.is_mocked === 1
      }))
    } catch { return [] }
  }

  // ============ Helpers ============

  private mapRowToMock(row: any): Mock {
    return {
      id: row.id, name: row.name, method: row.method, path: row.path,
      status: row.status, response: JSON.parse(row.response),
      headers: row.headers ? JSON.parse(row.headers) : undefined,
      cookies: row.cookies ? JSON.parse(row.cookies) : undefined,
      delay: row.delay, enabled: row.enabled === 1,
      description: row.description,
      tags: row.tags ? row.tags.split(',') : [],
      version: row.version, created_at: row.created_at, updated_at: row.updated_at
    }
  }

  close(): void {
    if (this.db) this.db.close()
  }
}

export default Database

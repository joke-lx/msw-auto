import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import type { Mock } from '../mock/manager.js'
import type { MockVersion } from '../mock/version-manager.js'

export class Database {
  private db: Database.Database | null = null
  private dbPath: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  async connect(): Promise<void> {
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema(): void {
    this.db!.exec(`
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
    const rows = this.db!.prepare('SELECT * FROM mocks ORDER BY created_at DESC').all() as any[]
    return rows.map(this.mapRowToMock)
  }

  async getMockById(id: string): Promise<Mock | null> {
    const row = this.db!.prepare('SELECT * FROM mocks WHERE id = ?').get(id) as any
    return row ? this.mapRowToMock(row) : null
  }

  async saveMock(mock: Mock): Promise<void> {
    const stmt = this.db!.prepare(`
      INSERT INTO mocks (id, name, method, path, status, response, headers, cookies, delay, enabled, description, tags, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      mock.id,
      mock.name,
      mock.method,
      mock.path,
      mock.status,
      JSON.stringify(mock.response),
      mock.headers ? JSON.stringify(mock.headers) : null,
      mock.cookies ? JSON.stringify(mock.cookies) : null,
      mock.delay || 0,
      mock.enabled ? 1 : 0,
      mock.description || null,
      mock.tags ? mock.tags.join(',') : null,
      mock.version,
      mock.created_at,
      mock.updated_at
    )
  }

  async updateMock(mock: Mock): Promise<void> {
    const stmt = this.db!.prepare(`
      UPDATE mocks SET
        name = ?, method = ?, path = ?, status = ?, response = ?,
        headers = ?, cookies = ?, delay = ?, enabled = ?,
        description = ?, tags = ?, version = ?, updated_at = ?
      WHERE id = ?
    `)

    stmt.run(
      mock.name,
      mock.method,
      mock.path,
      mock.status,
      JSON.stringify(mock.response),
      mock.headers ? JSON.stringify(mock.headers) : null,
      mock.cookies ? JSON.stringify(mock.cookies) : null,
      mock.delay || 0,
      mock.enabled ? 1 : 0,
      mock.description || null,
      mock.tags ? mock.tags.join(',') : null,
      mock.version,
      mock.updated_at,
      mock.id
    )
  }

  async deleteMock(id: string): Promise<void> {
    // Also delete versions
    this.db!.prepare('DELETE FROM mock_versions WHERE mock_id = ?').run(id)
    this.db!.prepare('DELETE FROM mocks WHERE id = ?').run(id)
  }

  // ============ Version Operations ============

  async saveMockVersion(version: MockVersion): Promise<void> {
    const stmt = this.db!.prepare(`
      INSERT INTO mock_versions (id, mock_id, version, response, headers, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      version.id,
      version.mock_id,
      version.version,
      JSON.stringify(version.response),
      version.headers ? JSON.stringify(version.headers) : null,
      version.description || null,
      version.created_at
    )
  }

  async getMockVersions(mockId: string): Promise<MockVersion[]> {
    const rows = this.db!.prepare('SELECT * FROM mock_versions WHERE mock_id = ? ORDER BY version DESC').all(mockId) as any[]
    return rows.map((row) => ({
      id: row.id,
      mock_id: row.mock_id,
      version: row.version,
      response: JSON.parse(row.response),
      headers: row.headers ? JSON.parse(row.headers) : undefined,
      description: row.description,
      created_at: row.created_at,
    }))
  }

  async getMockVersion(mockId: string, version: number): Promise<MockVersion | null> {
    const row = this.db!.prepare('SELECT * FROM mock_versions WHERE mock_id = ? AND version = ?').get(mockId, version) as any
    if (!row) return null

    return {
      id: row.id,
      mock_id: row.mock_id,
      version: row.version,
      response: JSON.parse(row.response),
      headers: row.headers ? JSON.parse(row.headers) : undefined,
      description: row.description,
      created_at: row.created_at,
    }
  }

  async deleteMockVersion(id: string): Promise<void> {
    this.db!.prepare('DELETE FROM mock_versions WHERE id = ?').run(id)
  }

  // ============ Request Log Operations ============

  async saveRequestLog(log: any): Promise<void> {
    const stmt = this.db!.prepare(`
      INSERT INTO request_logs (id, method, path, query, headers, body, response_status, response_body, response_time, is_mocked, mock_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      log.id,
      log.method,
      log.path,
      log.query ? JSON.stringify(log.query) : null,
      log.headers ? JSON.stringify(log.headers) : null,
      log.body ? JSON.stringify(log.body) : null,
      log.response_status,
      log.response_body ? JSON.stringify(log.response_body) : null,
      log.response_time,
      log.is_mocked ? 1 : 0,
      log.mock_id || null,
      log.timestamp
    )
  }

  async getRecentRequests(limit = 100): Promise<any[]> {
    const rows = this.db!.prepare('SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as any[]
    return rows.map((row) => ({
      ...row,
      headers: row.headers ? JSON.parse(row.headers) : null,
      query: row.query ? JSON.parse(row.query) : null,
      body: row.body ? JSON.parse(row.body) : null,
      response_body: row.response_body ? JSON.parse(row.response_body) : null,
      is_mocked: row.is_mocked === 1,
    }))
  }

  // ============ Helpers ============

  private mapRowToMock(row: any): Mock {
    return {
      id: row.id,
      name: row.name,
      method: row.method,
      path: row.path,
      status: row.status,
      response: JSON.parse(row.response),
      headers: row.headers ? JSON.parse(row.headers) : undefined,
      cookies: row.cookies ? JSON.parse(row.cookies) : undefined,
      delay: row.delay,
      enabled: row.enabled === 1,
      description: row.description,
      tags: row.tags ? row.tags.split(',') : [],
      version: row.version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }

  close(): void {
    this.db?.close()
  }
}

export default Database

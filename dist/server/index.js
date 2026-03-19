// src/server/index.ts
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer as WebSocketServer2 } from "ws";

// src/server/mock/manager.ts
import crypto from "crypto";
var MockManager = class {
  // 全局开关，默认开启
  constructor(database) {
    this.database = database;
    this.loadMocks();
  }
  mocks = /* @__PURE__ */ new Map();
  globalEnabled = true;
  async loadMocks() {
    try {
      const mocks = await this.database.getAllMocks();
      mocks.forEach((mock) => {
        this.mocks.set(mock.id, mock);
      });
    } catch (error) {
      console.log("[MockManager] Using in-memory storage");
    }
  }
  async create(dto) {
    const mock = {
      id: `mock_${crypto.randomUUID()}`,
      name: dto.name,
      method: dto.method.toUpperCase(),
      path: dto.path,
      status: dto.status || 200,
      response: dto.response,
      headers: dto.headers,
      cookies: dto.cookies,
      delay: dto.delay || 0,
      enabled: dto.enabled !== false,
      description: dto.description,
      tags: dto.tags,
      version: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.mocks.set(mock.id, mock);
    try {
      await this.database.saveMock(mock);
    } catch (error) {
    }
    return mock;
  }
  async update(id, updates) {
    const existing = this.mocks.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      method: updates.method?.toUpperCase() || existing.method,
      status: updates.status || existing.status,
      delay: updates.delay ?? existing.delay,
      enabled: updates.enabled ?? existing.enabled,
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      version: existing.version + 1
    };
    this.mocks.set(id, updated);
    try {
      await this.database.updateMock(updated);
    } catch (error) {
    }
    return updated;
  }
  async delete(id) {
    const existed = this.mocks.delete(id);
    if (existed) {
      try {
        await this.database.deleteMock(id);
      } catch (error) {
      }
    }
    return existed;
  }
  async findById(id) {
    return this.mocks.get(id) || null;
  }
  async findAll() {
    return Array.from(this.mocks.values());
  }
  async findEnabled() {
    return Array.from(this.mocks.values()).filter((mock) => mock.enabled);
  }
  // 全局开关相关方法
  isGlobalEnabled() {
    return this.globalEnabled;
  }
  setGlobalEnabled(enabled) {
    this.globalEnabled = enabled;
  }
  toggleGlobal() {
    this.globalEnabled = !this.globalEnabled;
    return this.globalEnabled;
  }
  findMatchingMock(method, path2) {
    if (!this.globalEnabled) {
      return null;
    }
    const enabledMocks = Array.from(this.mocks.values()).filter((mock) => mock.enabled);
    for (const mock of enabledMocks) {
      if (this.isMatch(method, path2, mock)) {
        return mock;
      }
    }
    return null;
  }
  isMatch(method, path2, mock) {
    if (mock.method !== "*" && mock.method !== method.toUpperCase()) {
      return false;
    }
    const mockPathParts = mock.path.split("/");
    const reqPathParts = path2.split("?")[0].split("/");
    if (mockPathParts.length !== reqPathParts.length) {
      return false;
    }
    for (let i = 0; i < mockPathParts.length; i++) {
      const mockPart = mockPathParts[i];
      const reqPart = reqPathParts[i];
      if (!mockPart && !reqPart) continue;
      if (mockPart.startsWith(":")) {
        continue;
      }
      if (mockPart === "*") {
        continue;
      }
      if (mockPart !== reqPart) {
        return false;
      }
    }
    return true;
  }
  async toggle(id) {
    const mock = this.mocks.get(id);
    if (!mock) return null;
    return this.update(id, { enabled: !mock.enabled });
  }
  async duplicate(id) {
    const original = this.mocks.get(id);
    if (!original) return null;
    return this.create({
      name: `${original.name} (copy)`,
      method: original.method,
      path: original.path,
      status: original.status,
      response: original.response,
      headers: original.headers,
      cookies: original.cookies,
      delay: original.delay,
      enabled: false,
      description: original.description,
      tags: original.tags
    });
  }
};

// src/server/storage/database.ts
import fs from "fs";
import path from "path";
var InMemoryStorage = class {
  mocks = /* @__PURE__ */ new Map();
  versions = /* @__PURE__ */ new Map();
  requestLogs = [];
  // Mock 操作
  async getAllMocks() {
    return Array.from(this.mocks.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  async getMockById(id) {
    return this.mocks.get(id) || null;
  }
  async saveMock(mock) {
    this.mocks.set(mock.id, mock);
  }
  async updateMock(mock) {
    this.mocks.set(mock.id, mock);
  }
  async deleteMock(id) {
    this.mocks.delete(id);
    this.versions.delete(id);
  }
  // Version 操作
  async saveMockVersion(version) {
    const existing = this.versions.get(version.mock_id) || [];
    existing.push(version);
    this.versions.set(version.mock_id, existing);
  }
  async getMockVersions(mockId) {
    return (this.versions.get(mockId) || []).sort((a, b) => b.version - a.version);
  }
  async getMockVersion(mockId, version) {
    const versions = this.versions.get(mockId) || [];
    return versions.find((v) => v.version === version) || null;
  }
  async deleteMockVersion(id) {
    for (const [mockId, versions] of this.versions) {
      this.versions.set(mockId, versions.filter((v) => v.id !== id));
    }
  }
  // Request log 操作
  async saveRequestLog(log) {
    this.requestLogs.unshift(log);
    if (this.requestLogs.length > 1e3) {
      this.requestLogs = this.requestLogs.slice(0, 1e3);
    }
  }
  async getRecentRequests(limit) {
    return this.requestLogs.slice(0, limit);
  }
};
var Database = class {
  db = null;
  dbPath;
  memory;
  useMemory = false;
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.memory = new InMemoryStorage();
  }
  async connect() {
    try {
      const Database2 = (await import("better-sqlite3")).default;
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database2(this.dbPath);
      this.db.pragma("journal_mode = WAL");
      this.initSchema();
      console.log("[Database] Connected to SQLite");
    } catch (error) {
      console.warn("[Database] Using in-memory storage (SQLite not available)");
      this.useMemory = true;
      this.db = null;
    }
  }
  initSchema() {
    if (!this.db) return;
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
    `);
  }
  // ============ Mock Operations ============
  async getAllMocks() {
    if (this.useMemory) return this.memory.getAllMocks();
    try {
      const rows = this.db.prepare("SELECT * FROM mocks ORDER BY created_at DESC").all();
      return rows.map(this.mapRowToMock);
    } catch {
      return [];
    }
  }
  async getMockById(id) {
    if (this.useMemory) return this.memory.getMockById(id);
    try {
      const row = this.db.prepare("SELECT * FROM mocks WHERE id = ?").get(id);
      return row ? this.mapRowToMock(row) : null;
    } catch {
      return null;
    }
  }
  async saveMock(mock) {
    if (this.useMemory) return this.memory.saveMock(mock);
    try {
      const stmt = this.db.prepare(`
        INSERT INTO mocks (id, name, method, path, status, response, headers, cookies, delay, enabled, description, tags, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
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
        mock.tags ? mock.tags.join(",") : null,
        mock.version,
        mock.created_at,
        mock.updated_at
      );
    } catch {
    }
  }
  async updateMock(mock) {
    if (this.useMemory) return this.memory.updateMock(mock);
    try {
      const stmt = this.db.prepare(`
        UPDATE mocks SET name = ?, method = ?, path = ?, status = ?, response = ?,
        headers = ?, cookies = ?, delay = ?, enabled = ?,
        description = ?, tags = ?, version = ?, updated_at = ?
        WHERE id = ?
      `);
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
        mock.tags ? mock.tags.join(",") : null,
        mock.version,
        mock.updated_at,
        mock.id
      );
    } catch {
    }
  }
  async deleteMock(id) {
    if (this.useMemory) return this.memory.deleteMock(id);
    try {
      this.db.prepare("DELETE FROM mock_versions WHERE mock_id = ?").run(id);
      this.db.prepare("DELETE FROM mocks WHERE id = ?").run(id);
    } catch {
    }
  }
  // ============ Version Operations ============
  async saveMockVersion(version) {
    if (this.useMemory) return this.memory.saveMockVersion(version);
    try {
      const stmt = this.db.prepare(`
        INSERT INTO mock_versions (id, mock_id, version, response, headers, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        version.id,
        version.mock_id,
        version.version,
        JSON.stringify(version.response),
        version.headers ? JSON.stringify(version.headers) : null,
        version.description || null,
        version.created_at
      );
    } catch {
    }
  }
  async getMockVersions(mockId) {
    if (this.useMemory) return this.memory.getMockVersions(mockId);
    try {
      const rows = this.db.prepare("SELECT * FROM mock_versions WHERE mock_id = ? ORDER BY version DESC").all(mockId);
      return rows.map((row) => ({
        id: row.id,
        mock_id: row.mock_id,
        version: row.version,
        response: JSON.parse(row.response),
        headers: row.headers ? JSON.parse(row.headers) : void 0,
        description: row.description,
        created_at: row.created_at
      }));
    } catch {
      return [];
    }
  }
  async getMockVersion(mockId, version) {
    if (this.useMemory) return this.memory.getMockVersion(mockId, version);
    try {
      const row = this.db.prepare("SELECT * FROM mock_versions WHERE mock_id = ? AND version = ?").get(mockId, version);
      if (!row) return null;
      return {
        id: row.id,
        mock_id: row.mock_id,
        version: row.version,
        response: JSON.parse(row.response),
        headers: row.headers ? JSON.parse(row.headers) : void 0,
        description: row.description,
        created_at: row.created_at
      };
    } catch {
      return null;
    }
  }
  async deleteMockVersion(id) {
    if (this.useMemory) return this.memory.deleteMockVersion(id);
    try {
      this.db.prepare("DELETE FROM mock_versions WHERE id = ?").run(id);
    } catch {
    }
  }
  // ============ Request Log Operations ============
  async saveRequestLog(log) {
    if (this.useMemory) return this.memory.saveRequestLog(log);
    try {
      const stmt = this.db.prepare(`
        INSERT INTO request_logs (id, method, path, query, headers, body, response_status, response_body, response_time, is_mocked, mock_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
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
      );
    } catch {
    }
  }
  async getRecentRequests(limit = 100) {
    if (this.useMemory) return this.memory.getRecentRequests(limit);
    try {
      const rows = this.db.prepare("SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT ?").all(limit);
      return rows.map((row) => ({
        ...row,
        headers: row.headers ? JSON.parse(row.headers) : null,
        query: row.query ? JSON.parse(row.query) : null,
        body: row.body ? JSON.parse(row.body) : null,
        response_body: row.response_body ? JSON.parse(row.response_body) : null,
        is_mocked: row.is_mocked === 1
      }));
    } catch {
      return [];
    }
  }
  // ============ Helpers ============
  mapRowToMock(row) {
    return {
      id: row.id,
      name: row.name,
      method: row.method,
      path: row.path,
      status: row.status,
      response: JSON.parse(row.response),
      headers: row.headers ? JSON.parse(row.headers) : void 0,
      cookies: row.cookies ? JSON.parse(row.cookies) : void 0,
      delay: row.delay,
      enabled: row.enabled === 1,
      description: row.description,
      tags: row.tags ? row.tags.split(",") : [],
      version: row.version,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
  close() {
    if (this.db) this.db.close();
  }
};

// src/server/routes/index.ts
import crypto3 from "crypto";
import http from "http";

// src/server/mock/version-manager.ts
import crypto2 from "crypto";
var VersionManager = class {
  database;
  maxVersions = 10;
  constructor(database) {
    this.database = database;
  }
  async createVersion(mockId, response, headers, description) {
    const versions = await this.database.getMockVersions(mockId);
    const versionNumber = versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;
    const version = {
      id: `ver_${crypto2.randomUUID()}`,
      mock_id: mockId,
      version: versionNumber,
      response,
      headers,
      description,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.database.saveMockVersion(version);
    await this.cleanupVersions(mockId);
    return version;
  }
  async getVersions(mockId) {
    return this.database.getMockVersions(mockId);
  }
  async getVersion(mockId, version) {
    return this.database.getMockVersion(mockId, version);
  }
  async rollback(mockId, targetVersion) {
    const version = await this.getVersion(mockId, targetVersion);
    if (!version) {
      return null;
    }
    return this.createVersion(mockId, version.response, version.headers, `Rolled back to version ${targetVersion}`);
  }
  async cleanupVersions(mockId) {
    const versions = await this.database.getMockVersions(mockId);
    if (versions.length > this.maxVersions) {
      versions.sort((a, b) => b.version - a.version);
      const toDelete = versions.slice(this.maxVersions);
      for (const version of toDelete) {
        await this.database.deleteMockVersion(version.id);
      }
    }
  }
  async compareVersions(mockId, version1, version2) {
    const v1 = await this.getVersion(mockId, version1);
    const v2 = await this.getVersion(mockId, version2);
    const differences = [];
    if (v1 && v2) {
      if (JSON.stringify(v1.response) !== JSON.stringify(v2.response)) {
        differences.push("Response body changed");
      }
      if (JSON.stringify(v1.headers) !== JSON.stringify(v2.headers)) {
        differences.push("Headers changed");
      }
    }
    return { v1, v2, differences };
  }
};

// src/server/import-export/importer.ts
import pc from "picocolors";
var ImportExporter = class {
  /**
   * Import from OpenAPI/Swagger specification
   */
  async fromOpenAPI(spec) {
    const mocks = [];
    console.log(pc.cyan("[Import] Processing OpenAPI specification..."));
    for (const [path2, pathItem] of Object.entries(spec.paths)) {
      const methods = ["get", "post", "put", "delete", "patch", "options", "head"];
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;
        const mock = this.convertOpenAPIToMock(method.toUpperCase(), path2, operation, spec);
        mocks.push(mock);
      }
    }
    console.log(pc.green(`[Import] Generated ${mocks.length} mocks from OpenAPI`));
    return mocks;
  }
  /**
   * Import from Postman collection
   */
  async fromPostman(collection) {
    const mocks = [];
    console.log(pc.cyan("[Import] Processing Postman collection..."));
    const processItems = (items, basePath = "") => {
      for (const item of items) {
        if (item.item) {
          processItems(item.item, basePath);
        } else if (item.request) {
          const mock = this.convertPostmanToMock(item, basePath);
          if (mock) {
            mocks.push(mock);
          }
        }
      }
    };
    processItems(collection.item);
    console.log(pc.green(`[Import] Generated ${mocks.length} mocks from Postman`));
    return mocks;
  }
  /**
   * Export to OpenAPI specification
   */
  toOpenAPI(mocks) {
    const paths = {};
    for (const mock of mocks) {
      const method = mock.method.toLowerCase();
      if (!paths[mock.path]) {
        paths[mock.path] = {};
      }
      paths[mock.path][method] = {
        summary: mock.name,
        description: mock.description,
        tags: mock.tags,
        responses: {
          [mock.status.toString()]: {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object"
                },
                example: mock.response
              }
            }
          }
        }
      };
    }
    return {
      openapi: "3.0.0",
      info: {
        title: "MSW Auto Export",
        version: "1.0.0",
        description: "Generated from MSW Auto mocks"
      },
      paths,
      components: {
        schemas: {}
      }
    };
  }
  /**
   * Export to Postman collection
   */
  toPostman(mocks) {
    const items = mocks.map((mock) => ({
      name: mock.name,
      request: {
        method: mock.method,
        url: {
          raw: mock.path,
          path: mock.path.split("/").filter(Boolean)
        },
        header: mock.headers ? Object.entries(mock.headers).map(([key, value]) => ({ key, value })) : [],
        body: {
          mode: "raw",
          raw: JSON.stringify(mock.response, null, 2)
        }
      }
    }));
    return {
      info: {
        name: "MSW Auto Export",
        description: "Generated from MSW Auto mocks",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: items
    };
  }
  /**
   * Export to JSON file
   */
  toJSON(mocks) {
    return JSON.stringify(mocks, null, 2);
  }
  // ============ Private Helpers ============
  convertOpenAPIToMock(method, path2, operation, spec) {
    const response = this.generateMockResponse(operation, spec);
    const statusCode = this.extractStatusCode(operation.responses);
    return {
      name: operation.summary || operation.operationId || `${method} ${path2}`,
      method,
      path: this.convertPathParams(path2),
      status: statusCode,
      response,
      description: operation.description || operation.summary,
      tags: operation.tags,
      headers: {
        "Content-Type": "application/json"
      },
      enabled: true
    };
  }
  convertPostmanToMock(item, basePath) {
    if (!item.request) return null;
    const method = item.request.method;
    let url = "";
    if (typeof item.request.url === "string") {
      url = item.request.url;
    } else if (item.request.url?.raw) {
      url = item.request.url.raw;
    }
    const fullPath = basePath ? `${basePath}/${url}`.replace(/\/+/g, "/") : url;
    let response = { message: "Mock response" };
    if (item.request.body?.raw) {
      try {
        response = JSON.parse(item.request.body.raw);
      } catch {
      }
    }
    return {
      name: item.name,
      method,
      path: fullPath,
      status: 200,
      response,
      description: item.name,
      enabled: true
    };
  }
  convertPathParams(path2) {
    return path2.replace(/\{(\w+)\}/g, ":$1");
  }
  generateMockResponse(operation, spec) {
    const successResponse = operation.responses?.["200"] || operation.responses?.["201"] || operation.responses?.["default"];
    if (!successResponse?.content?.["application/json"]?.example) {
      const schema = successResponse?.content?.["application/json"]?.schema;
      if (schema) {
        return this.generateFromSchema(schema, spec.components?.schemas || {});
      }
      return { message: "Mock response" };
    }
    return successResponse.content["application/json"].example;
  }
  generateFromSchema(schema, definitions) {
    if (!schema) return null;
    if (schema.$ref) {
      const refName = schema.$ref.split("/").pop();
      if (refName && definitions[refName]) {
        return this.generateFromSchema(definitions[refName], definitions);
      }
    }
    switch (schema.type) {
      case "object":
        if (schema.properties) {
          const obj = {};
          for (const [key, prop] of Object.entries(schema.properties)) {
            obj[key] = this.generateFromSchema(prop, definitions);
          }
          return obj;
        }
        return {};
      case "array":
        if (schema.items) {
          return [this.generateFromSchema(schema.items, definitions)];
        }
        return [];
      case "string":
        if (schema.enum) return schema.enum[0];
        if (schema.format === "date-time") return (/* @__PURE__ */ new Date()).toISOString();
        if (schema.format === "date") return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        if (schema.format === "email") return "user@example.com";
        if (schema.format === "uri") return "https://example.com";
        return "string";
      case "integer":
      case "number":
        return schema.minimum || 0;
      case "boolean":
        return true;
      default:
        return null;
    }
  }
  extractStatusCode(responses) {
    if (!responses) return 200;
    if (responses["200"]) return 200;
    if (responses["201"]) return 201;
    if (responses["202"]) return 202;
    const codes = Object.keys(responses);
    if (codes.length > 0) {
      return parseInt(codes[0]) || 200;
    }
    return 200;
  }
};

// src/server/routes/index.ts
import pc2 from "picocolors";
function setupRoutes(app, mockManager, database, config, claudeClient2) {
  const versionManager = new VersionManager(database);
  const importer = new ImportExporter();
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      globalEnabled: mockManager.isGlobalEnabled()
    });
  });
  app.get("/api/global-toggle", (req, res) => {
    res.json({ enabled: mockManager.isGlobalEnabled() });
  });
  app.post("/api/global-toggle", (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled === "boolean") {
      mockManager.setGlobalEnabled(enabled);
      res.json({ enabled: mockManager.isGlobalEnabled() });
    } else {
      const newState = mockManager.toggleGlobal();
      res.json({ enabled: newState });
    }
  });
  app.get("/api/mocks", async (req, res) => {
    try {
      const mocks = await mockManager.findAll();
      res.json(mocks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/mocks/:id", async (req, res) => {
    try {
      const mock = await mockManager.findById(req.params.id);
      if (!mock) {
        return res.status(404).json({ error: "Mock not found" });
      }
      res.json(mock);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/mocks", async (req, res) => {
    try {
      const mock = await mockManager.create(req.body);
      res.status(201).json(mock);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.put("/api/mocks/:id", async (req, res) => {
    try {
      const mock = await mockManager.update(req.params.id, req.body);
      if (!mock) {
        return res.status(404).json({ error: "Mock not found" });
      }
      res.json(mock);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.delete("/api/mocks/:id", async (req, res) => {
    try {
      const deleted = await mockManager.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Mock not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/mocks/:id/toggle", async (req, res) => {
    try {
      const mock = await mockManager.toggle(req.params.id);
      if (!mock) {
        return res.status(404).json({ error: "Mock not found" });
      }
      res.json(mock);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/mocks/:id/duplicate", async (req, res) => {
    try {
      const mock = await mockManager.duplicate(req.params.id);
      if (!mock) {
        return res.status(404).json({ error: "Mock not found" });
      }
      res.status(201).json(mock);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { method, path: path2, description, context } = req.body;
      if (!method || !path2) {
        return res.status(400).json({ error: "method and path are required" });
      }
      const generated = await claudeClient2.generateMock({
        method,
        path: path2,
        description,
        context
      });
      const mock = await mockManager.create(generated);
      res.status(201).json(mock);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/ai/improve/:id", async (req, res) => {
    try {
      const { instruction } = req.body;
      if (!instruction) {
        return res.status(400).json({ error: "instruction is required" });
      }
      const existingMock = await mockManager.findById(req.params.id);
      if (!existingMock) {
        return res.status(404).json({ error: "Mock not found" });
      }
      const improved = await claudeClient2.improveMock(existingMock, instruction);
      const updated = await mockManager.update(req.params.id, improved);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/ai/docs/:id", async (req, res) => {
    try {
      const mock = await mockManager.findById(req.params.id);
      if (!mock) {
        return res.status(404).json({ error: "Mock not found" });
      }
      const documentation = await claudeClient2.generateDocumentation(mock);
      res.json({ documentation });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, context } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const reply = await claudeClient2.chat(messages, context);
      res.json({ reply });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/ai/status", (req, res) => {
    res.json({
      enabled: claudeClient2.isEnabled(),
      provider: "Anthropic Claude"
    });
  });
  app.get("/api/mocks/:id/versions", async (req, res) => {
    try {
      const versions = await versionManager.getVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/mocks/:id/versions/:version", async (req, res) => {
    try {
      const version = await versionManager.getVersion(req.params.id, parseInt(req.params.version));
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      res.json(version);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/mocks/:id/versions", async (req, res) => {
    try {
      const mock = await mockManager.findById(req.params.id);
      if (!mock) {
        return res.status(404).json({ error: "Mock not found" });
      }
      const version = await versionManager.createVersion(
        mock.id,
        mock.response,
        mock.headers,
        req.body.description
      );
      res.status(201).json(version);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/mocks/:id/versions/:version/rollback", async (req, res) => {
    try {
      const version = await versionManager.rollback(
        req.params.id,
        parseInt(req.params.version)
      );
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      const mock = await mockManager.update(req.params.id, {
        response: version.response,
        headers: version.headers
      });
      res.json(mock);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/mocks/:id/versions/compare", async (req, res) => {
    try {
      const v1 = parseInt(req.query.v1);
      const v2 = parseInt(req.query.v2);
      if (!v1 || !v2) {
        return res.status(400).json({ error: "v1 and v2 query params required" });
      }
      const comparison = await versionManager.compareVersions(req.params.id, v1, v2);
      res.json(comparison);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/import/openapi", async (req, res) => {
    try {
      const spec = req.body;
      const mocks = await importer.fromOpenAPI(spec);
      const created = [];
      for (const mockData of mocks) {
        const mock = await mockManager.create(mockData);
        created.push(mock);
      }
      res.status(201).json({
        imported: created.length,
        mocks: created
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post("/api/import/postman", async (req, res) => {
    try {
      const collection = req.body;
      const mocks = await importer.fromPostman(collection);
      const created = [];
      for (const mockData of mocks) {
        const mock = await mockManager.create(mockData);
        created.push(mock);
      }
      res.status(201).json({
        imported: created.length,
        mocks: created
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.get("/api/export/openapi", async (req, res) => {
    try {
      const mocks = await mockManager.findAll();
      const spec = importer.toOpenAPI(mocks);
      res.json(spec);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/export/postman", async (req, res) => {
    try {
      const mocks = await mockManager.findAll();
      const collection = importer.toPostman(mocks);
      res.json(collection);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/export/json", async (req, res) => {
    try {
      const mocks = await mockManager.findAll();
      const json = importer.toJSON(mocks);
      res.header("Content-Type", "application/json");
      res.header("Content-Disposition", 'attachment; filename="mocks.json"');
      res.send(json);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/requests", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const requests = await database.getRecentRequests(limit);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/stats", async (req, res) => {
    try {
      const mocks = await mockManager.findAll();
      const enabledMocks = mocks.filter((m) => m.enabled).length;
      res.json({
        totalMocks: mocks.length,
        activeMocks: enabledMocks,
        disabledMocks: mocks.length - enabledMocks,
        aiEnabled: claudeClient2.isEnabled(),
        globalEnabled: mockManager.isGlobalEnabled()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.all("*", async (req, res) => {
    const startTime = Date.now();
    const mock = mockManager.findMatchingMock(req.method, req.path);
    if (mock) {
      if (mock.delay && mock.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, mock.delay));
      }
      if (mock.headers) {
        Object.entries(mock.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      if (mock.cookies) {
        Object.entries(mock.cookies).forEach(([key, value]) => {
          res.cookie(key, value);
        });
      }
      const duration = Date.now() - startTime;
      await database.saveRequestLog({
        id: `req_${crypto3.randomUUID()}`,
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
        body: req.body,
        response_status: mock.status,
        response_body: mock.response,
        response_time: duration,
        is_mocked: true,
        mock_id: mock.id,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log(
        `${pc2.gray((/* @__PURE__ */ new Date()).toISOString())} ${pc2.blue(req.method)} ${pc2.green(req.path)} ${pc2.green("Mock")}`
      );
      return res.status(mock.status).json(mock.response);
    }
    if (config.backendUrl) {
      console.log(
        `${pc2.gray((/* @__PURE__ */ new Date()).toISOString())} ${pc2.blue(req.method)} ${pc2.yellow(req.path)} ${pc2.cyan("Proxy")}`
      );
      const targetUrl = new URL(req.path, config.backendUrl);
      const proxyReq = http.request({
        hostname: targetUrl.hostname,
        port: targetUrl.port || 80,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: targetUrl.host
        }
      }, (proxyRes) => {
        res.status(proxyRes.statusCode || 200);
        proxyRes.headers && Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (value) res.setHeader(key, value);
        });
        proxyRes.pipe(res);
      });
      proxyReq.on("error", (err) => {
        console.error(pc2.red(`[Proxy] Error: ${err.message}`));
        res.status(502).json({
          error: "Bad Gateway",
          message: `Failed to proxy request: ${err.message}`
        });
      });
      if (req.body && Object.keys(req.body).length > 0) {
        proxyReq.write(JSON.stringify(req.body));
      }
      proxyReq.end();
      return;
    }
    await database.saveRequestLog({
      id: `req_${crypto3.randomUUID()}`,
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
      body: req.body,
      response_status: 404,
      response_body: null,
      response_time: Date.now() - startTime,
      is_mocked: false,
      mock_id: null,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.status(404).json({
      error: "Not Found",
      message: `No mock found for ${req.method} ${req.path}`
    });
  });
}

// src/server/websocket/index.ts
import { WebSocket } from "ws";
import crypto4 from "crypto";
import pc3 from "picocolors";
function setupWebSocket(wss, mockManager, database) {
  const clients = /* @__PURE__ */ new Map();
  wss.on("connection", (ws) => {
    const clientId = `client_${crypto4.randomUUID()}`;
    const client = {
      id: clientId,
      ws
    };
    clients.set(clientId, client);
    console.log(pc3.green(`[WebSocket] Client connected: ${clientId}`));
    ws.send(
      JSON.stringify({
        type: "CONNECTED",
        data: {
          clientId,
          message: "Connected to MSW Auto server"
        }
      })
    );
    updateStats();
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(client, message);
      } catch (error) {
        console.error(pc3.red("[WebSocket] Failed to parse message:"), error);
        ws.send(
          JSON.stringify({
            type: "ERROR",
            data: { message: "Invalid message format" }
          })
        );
      }
    });
    ws.on("close", () => {
      clients.delete(clientId);
      console.log(pc3.yellow(`[WebSocket] Client disconnected: ${clientId}`));
    });
    ws.on("error", (error) => {
      console.error(pc3.red(`[WebSocket] Error for client ${clientId}:`), error);
      clients.delete(clientId);
    });
    function handleMessage(client2, message) {
      switch (message.type) {
        case "SUBSCRIBE":
          client2.subscribedMocks = message.mocks || [];
          ws.send(
            JSON.stringify({
              type: "SUBSCRIBED",
              data: { mocks: client2.subscribedMocks }
            })
          );
          break;
        case "PING":
          ws.send(JSON.stringify({ type: "PONG", data: { timestamp: Date.now() } }));
          break;
        case "GET_STATS":
          updateStats();
          break;
        default:
          ws.send(
            JSON.stringify({
              type: "ERROR",
              data: { message: `Unknown message type: ${message.type}` }
            })
          );
      }
    }
    async function updateStats() {
      try {
        const mocks = await mockManager.findAll();
        const requests = await database.getRecentRequests(10);
        const stats = {
          totalMocks: mocks.length,
          activeMocks: mocks.filter((m) => m.enabled).length,
          recentRequests: requests.length
        };
        broadcast(
          {
            type: "STATS",
            data: stats
          },
          client.id
        );
      } catch (error) {
        console.error(pc3.red("[WebSocket] Failed to get stats:"), error);
      }
    }
  });
  function broadcast(message, excludeClientId) {
    const data = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    });
  }
  setInterval(async () => {
    try {
      const mocks = await mockManager.findAll();
      const requests = await database.getRecentRequests(10);
      broadcast({
        type: "STATS",
        data: {
          totalMocks: mocks.length,
          activeMocks: mocks.filter((m) => m.enabled).length,
          recentRequests: requests.length
        }
      });
    } catch (error) {
    }
  }, 3e4);
}

// src/server/llm/claude-client.ts
import Anthropic from "@anthropic-ai/sdk";

// src/server/llm/prompt-builder.ts
var PromptBuilder = class {
  buildMockPrompt(request) {
    const { method, path: path2, description, context } = request;
    let prompt = `
Generate a realistic mock response for the following API endpoint:

**HTTP Method:** ${method}
**Path:** ${path2}
${description ? `**Description:** ${description}` : ""}

Requirements:
1. Generate realistic mock data that matches typical API responses
2. Include all necessary fields for a complete response
3. Use appropriate data types (strings, numbers, booleans, arrays, objects)
4. Provide realistic example values
5. Include proper HTTP status code
6. Add optional fields with null values where appropriate
7. Include metadata fields like id, created_at, updated_at where appropriate

Response format (JSON):
\`\`\`json
{
  "name": "Descriptive name for this endpoint",
  "method": "${method}",
  "path": "${path2}",
  "status": 200,
  "response": {
    // Your generated mock data here
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "delay": 0,
  "description": "Brief description",
  "tags": ["tag1", "tag2"]
}
\`\`\`
`.trim();
    if (context?.existingMocks && context.existingMocks.length > 0) {
      prompt += `

Existing mocks in the project:
${JSON.stringify(context.existingMocks.slice(0, 3), null, 2)}`;
    }
    return prompt;
  }
  buildSystemPrompt(context = {}) {
    let prompt = `
You are an expert API mock generator with deep knowledge of:

- RESTful API design principles
- GraphQL specifications
- HTTP protocols and status codes
- JSON Schema and data modeling
- Various programming languages and frameworks

Your core responsibilities:
1. Generate realistic, well-structured mock data
2. Ensure data consistency across related endpoints
3. Follow industry best practices for API design
4. Handle edge cases and error scenarios appropriately

Guidelines:
- Always return valid JSON
- Use appropriate HTTP status codes (200 for success, 201 for created, 400 for bad request, 404 for not found, 500 for server error)
- Include proper response headers
- Generate realistic example values
- Maintain consistency in naming conventions
- Handle optional fields correctly
- Include error responses when appropriate
- Consider pagination, filtering, and sorting for list endpoints

When generating mock data:
- Use realistic names, emails, phone numbers
- Include appropriate timestamps (ISO 8601 format)
- Generate realistic IDs (UUIDs or integers)
- Include relationship fields (foreign keys)
- Add metadata fields (created_at, updated_at)
- Use appropriate field types matching the data
`.trim();
    if (context?.projectInfo) {
      prompt += `

Project Context:
${JSON.stringify(context.projectInfo, null, 2)}`;
    }
    return prompt;
  }
  buildImprovePrompt(mock, instruction) {
    return `
You have the following existing mock:

\`\`\`json
${JSON.stringify(mock, null, 2)}
\`\`\`

User wants to improve it with the following instruction:
"${instruction}"

Please improve the mock according to the instruction while:
1. Maintaining the existing structure
2. Enhancing data quality and realism
3. Adding any missing fields
4. Improving edge case handling
5. Keeping response format consistent

Return the improved mock in the same JSON format:
\`\`\`json
{
  "name": "...",
  "method": "...",
  "path": "...",
  "status": ...,
  "response": { ... },
  "headers": { ... },
  "delay": ...,
  "description": "...",
  "tags": [...]
}
\`\`\`
`.trim();
  }
  buildOpenAPIPrompt(openApiSpec) {
    return `
Analyze the following OpenAPI/Swagger specification and generate mock data for all endpoints:

\`\`\`json
${JSON.stringify(openApiSpec, null, 2)}
\`\`\`

For each endpoint, generate:
1. A successful response (200, 201, etc.)
2. An error response (400, 404, 500, etc.) if applicable

Requirements:
1. Follow the schema definitions exactly
2. Use realistic example values
3. Handle all required fields
4. Include optional fields with null values where appropriate
5. Generate array responses with multiple items (3-5 items for lists)
6. Maintain consistency across related endpoints

Return the result as an array of mock objects:
\`\`\`json
[
  {
    "name": "Get Users",
    "method": "GET",
    "path": "/api/users",
    "status": 200,
    "response": { "data": [...], "total": 100 },
    "headers": { "Content-Type": "application/json" },
    "delay": 0,
    "description": "Get all users",
    "tags": ["users", "list"]
  }
]
\`\`\`
`.trim();
  }
  buildDocumentationPrompt(mock) {
    return `
Generate comprehensive API documentation in Markdown format for the following mock endpoint:

\`\`\`json
${JSON.stringify(mock, null, 2)}
\`\`\`

Please generate documentation that includes:
1. Endpoint overview and description
2. HTTP method and full URL
3. Request parameters (path, query, headers, body)
4. Response structure and status codes
5. Field definitions with types and descriptions
6. Example requests and responses
7. Error codes and handling

Format as clean Markdown.
`.trim();
  }
  buildDocumentationSystemPrompt() {
    return `
You are an expert API documentation generator with deep knowledge of:
- RESTful API documentation standards
- Markdown formatting
- Multiple programming languages
- API design best practices

Your task is to generate clear, comprehensive API documentation that is:
- Well-structured with proper headings
- Includes all necessary details for developers
- Has clear examples
- Uses proper Markdown syntax
`.trim();
  }
  buildCodeExamplesPrompt(mock, languages) {
    return `
Generate code examples for calling the following API endpoint in these languages: ${languages.join(", ")}

API Details:
\`\`\`json
${JSON.stringify(mock, null, 2)}
\`\`\`

Requirements:
1. Generate complete, working examples for each language
2. Include proper error handling
3. Add comments explaining the code
4. Use popular, well-maintained libraries
5. Include authentication if required

Return as JSON:
\`\`\`json
{
  "javascript": "// code here",
  "python": "# code here",
  "curl": "curl command here"
}
\`\`\`
`.trim();
  }
};

// src/server/llm/response-parser.ts
var ResponseParser = class {
  parseMockResponse(response) {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      const codeMatch = response.match(/```\n([\s\S]*?)\n```/);
      if (codeMatch) {
        return JSON.parse(codeMatch[1]);
      }
      return JSON.parse(response);
    } catch (error) {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error(`Failed to parse mock response: ${error.message}`);
        }
      }
      throw new Error("Invalid mock response format - no valid JSON found");
    }
  }
  parseMultipleMocks(response) {
    try {
      const data = this.parseMockResponse(response);
      if (Array.isArray(data)) {
        return data;
      }
      if (data.mocks && Array.isArray(data.mocks)) {
        return data.mocks;
      }
      if (data.endpoints && Array.isArray(data.endpoints)) {
        return data.endpoints;
      }
      throw new Error("Invalid multiple mocks response format");
    } catch (error) {
      throw new Error(`Failed to parse multiple mocks: ${error.message}`);
    }
  }
  parseCodeExamples(response, languages) {
    try {
      const data = this.parseMockResponse(response);
      const examples = {};
      for (const lang of languages) {
        if (data[lang]) {
          examples[lang] = data[lang];
        }
      }
      if (Object.keys(examples).length === 0) {
        languages.forEach((lang) => {
          const regex = new RegExp(`\`\`\`${lang}\\n([\\s\\S]*?)\\n\`\`\``, "i");
          const match = response.match(regex);
          if (match) {
            examples[lang] = match[1];
          }
        });
      }
      return examples;
    } catch (error) {
      throw new Error(`Failed to parse code examples: ${error.message}`);
    }
  }
  parseDocumentation(response) {
    return response.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
  }
};

// src/server/llm/claude-client.ts
import pc4 from "picocolors";
var ClaudeClient = class {
  client = null;
  promptBuilder;
  responseParser;
  config;
  enabled = false;
  constructor(config = {}) {
    this.config = {
      model: config.model || "claude-sonnet-4-20250514",
      maxTokens: config.maxTokens || 4096,
      baseURL: config.baseURL,
      ...config
    };
    this.promptBuilder = new PromptBuilder();
    this.responseParser = new ResponseParser();
  }
  async initialize() {
    if (!this.config.apiKey) {
      console.log(pc4.yellow("[Claude] API key not configured, AI features disabled"));
      return false;
    }
    try {
      this.client = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL
      });
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }]
      });
      this.enabled = true;
      console.log(pc4.green("[Claude] Connected successfully"));
      return true;
    } catch (error) {
      console.error(pc4.red("[Claude] Failed to initialize:"), error.message);
      this.enabled = false;
      return false;
    }
  }
  isEnabled() {
    return this.enabled;
  }
  async generateMock(request) {
    if (!this.enabled || !this.client) {
      throw new Error("Claude client not initialized");
    }
    try {
      const prompt = this.promptBuilder.buildMockPrompt(request);
      const systemPrompt = this.promptBuilder.buildSystemPrompt(request.context);
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }]
      });
      const content = response.content[0];
      const mockData = this.responseParser.parseMockResponse(content.text);
      console.log(pc4.green("[Claude] Mock generated successfully"));
      return {
        name: mockData.name || request.path,
        method: mockData.method || request.method,
        path: mockData.path || request.path,
        status: mockData.status || 200,
        response: mockData.response || { message: "Generated by AI" },
        headers: mockData.headers,
        delay: mockData.delay || 0,
        enabled: true,
        description: mockData.description || request.description,
        tags: mockData.tags
      };
    } catch (error) {
      console.error(pc4.red("[Claude] Error generating mock:"), error.message);
      throw new Error(`Failed to generate mock: ${error.message}`);
    }
  }
  async generateMultipleMocks(spec) {
    if (!this.enabled || !this.client) {
      throw new Error("Claude client not initialized");
    }
    try {
      const prompt = this.promptBuilder.buildOpenAPIPrompt(spec);
      const systemPrompt = this.promptBuilder.buildSystemPrompt({});
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }]
      });
      const content = response.content[0];
      const mocks = this.responseParser.parseMultipleMocks(content.text);
      console.log(pc4.green(`[Claude] Generated ${mocks.length} mocks`));
      return mocks;
    } catch (error) {
      console.error(pc4.red("[Claude] Error generating mocks:"), error.message);
      throw new Error(`Failed to generate mocks: ${error.message}`);
    }
  }
  async chat(messages, context = {}) {
    if (!this.enabled || !this.client) {
      throw new Error("Claude client not initialized");
    }
    try {
      const systemPrompt = this.promptBuilder.buildSystemPrompt(context);
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages
      });
      const content = response.content[0];
      return content.text;
    } catch (error) {
      console.error(pc4.red("[Claude] Error in chat:"), error.message);
      throw new Error(`Chat failed: ${error.message}`);
    }
  }
  async improveMock(mock, instruction) {
    if (!this.enabled || !this.client) {
      throw new Error("Claude client not initialized");
    }
    try {
      const prompt = this.promptBuilder.buildImprovePrompt(mock, instruction);
      const systemPrompt = this.promptBuilder.buildSystemPrompt({});
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }]
      });
      const content = response.content[0];
      const improvedData = this.responseParser.parseMockResponse(content.text);
      console.log(pc4.green("[Claude] Mock improved successfully"));
      return improvedData;
    } catch (error) {
      console.error(pc4.red("[Claude] Error improving mock:"), error.message);
      throw new Error(`Failed to improve mock: ${error.message}`);
    }
  }
  async generateDocumentation(mock) {
    if (!this.enabled || !this.client) {
      throw new Error("Claude client not initialized");
    }
    try {
      const prompt = this.promptBuilder.buildDocumentationPrompt(mock);
      const systemPrompt = this.promptBuilder.buildDocumentationSystemPrompt();
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }]
      });
      const content = response.content[0];
      return content.text;
    } catch (error) {
      console.error(pc4.red("[Claude] Error generating documentation:"), error.message);
      throw new Error(`Failed to generate documentation: ${error.message}`);
    }
  }
};
var claudeClient = null;
function getClaudeClient(config) {
  if (!claudeClient) {
    claudeClient = new ClaudeClient(config);
  }
  return claudeClient;
}

// src/server/index.ts
import pc5 from "picocolors";
import fs2 from "fs";
function loadConfig() {
  const configPath = "./data/config.json";
  let envConfig = {};
  if (fs2.existsSync(configPath)) {
    try {
      envConfig = JSON.parse(fs2.readFileSync(configPath, "utf-8"));
    } catch (e) {
    }
  }
  return {
    port: parseInt(process.env.PORT || envConfig.port || "3001"),
    webPort: parseInt(process.env.WEB_PORT || envConfig.webPort || "3000"),
    backendUrl: process.env.BACKEND_URL || envConfig.backendUrl,
    dbPath: process.env.DB_PATH || envConfig.dbPath || "./data/mocks.db",
    claudeApiKey: process.env.ANTHROPIC_API_KEY || envConfig.claudeApiKey
  };
}
var MockServer = class {
  app;
  server;
  wss;
  mockManager;
  database;
  claudeClient;
  config;
  constructor(config = {}) {
    const loadedConfig = loadConfig();
    this.config = {
      ...loadedConfig,
      ...config
    };
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer2({ server: this.server, path: "/ws" });
    this.database = new Database(this.config.dbPath);
    this.mockManager = new MockManager(this.database);
    this.claudeClient = getClaudeClient({
      apiKey: this.config.claudeApiKey
    });
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }
  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(
          `${pc5.gray((/* @__PURE__ */ new Date()).toISOString())} ${pc5.blue(req.method)} ${req.path} ${pc5.yellow(res.statusCode.toString())} ${pc5.gray(duration + "ms")}`
        );
        this.broadcast({
          type: "REQUEST",
          data: {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      });
      next();
    });
  }
  setupRoutes() {
    setupRoutes(this.app, this.mockManager, this.database, this.config, this.claudeClient);
  }
  setupWebSocket() {
    setupWebSocket(this.wss, this.mockManager, this.database);
  }
  broadcast(data) {
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }
  async start() {
    try {
      await this.database.connect();
      console.log(pc5.green("[Database] Connected"));
      await this.claudeClient.initialize();
      return new Promise((resolve) => {
        this.server.listen(this.config.port, () => {
          console.log(`
${pc5.cyan("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557")}
${pc5.cyan("\u2551")}     ${pc5.bold(pc5.blue("MSW Auto Server"))}                          ${pc5.cyan("\u2551")}
${pc5.cyan("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}
${pc5.dim("\u2501".repeat(62))}

${pc5.green("[Server]")} Mock server running on ${pc5.bold(`http://localhost:${this.config.port}`)}
${pc5.green("[WebUI]")} Web UI available at ${pc5.bold(`http://localhost:${this.config.webPort}`)}
${pc5.cyan("[WebSocket]")} WS available at ${pc5.bold(`ws://localhost:${this.config.port}/ws`)}

${pc5.yellow("Press Ctrl+C to stop the server")}
`);
          resolve();
        });
      });
    } catch (error) {
      console.error(pc5.red("[Error] Failed to start server:"), error);
      process.exit(1);
    }
  }
  stop() {
    this.server.close();
    this.database.close();
    console.log(pc5.yellow("[Server] Stopped"));
  }
};
var isMain = import.meta.url.includes("index.js") || import.meta.url.includes("index.ts") || process.argv[1]?.includes("server");
if (isMain) {
  const server = new MockServer();
  server.start();
  process.on("SIGINT", () => {
    server.stop();
    process.exit(0);
  });
}
export {
  MockServer
};
//# sourceMappingURL=index.js.map
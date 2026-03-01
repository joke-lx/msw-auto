import crypto from 'crypto'
import type { Database } from '../storage/database.js'

export interface MockVersion {
  id: string
  mock_id: string
  version: number
  response: any
  headers?: Record<string, string>
  description?: string
  created_at: string
}

export class VersionManager {
  private database: Database
  private maxVersions: number = 10

  constructor(database: Database) {
    this.database = database
  }

  async createVersion(mockId: string, response: any, headers?: Record<string, string>, description?: string): Promise<MockVersion> {
    // Get current version number
    const versions = await this.database.getMockVersions(mockId)
    const versionNumber = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1

    const version: MockVersion = {
      id: `ver_${crypto.randomUUID()}`,
      mock_id: mockId,
      version: versionNumber,
      response,
      headers,
      description,
      created_at: new Date().toISOString(),
    }

    await this.database.saveMockVersion(version)

    // Cleanup old versions
    await this.cleanupVersions(mockId)

    return version
  }

  async getVersions(mockId: string): Promise<MockVersion[]> {
    return this.database.getMockVersions(mockId)
  }

  async getVersion(mockId: string, version: number): Promise<MockVersion | null> {
    return this.database.getMockVersion(mockId, version)
  }

  async rollback(mockId: string, targetVersion: number): Promise<MockVersion | null> {
    const version = await this.getVersion(mockId, targetVersion)
    if (!version) {
      return null
    }

    // Create a new version for the rollback
    return this.createVersion(mockId, version.response, version.headers, `Rolled back to version ${targetVersion}`)
  }

  private async cleanupVersions(mockId: string): Promise<void> {
    const versions = await this.database.getMockVersions(mockId)

    if (versions.length > this.maxVersions) {
      // Sort by version descending
      versions.sort((a, b) => b.version - a.version)

      // Delete oldest versions
      const toDelete = versions.slice(this.maxVersions)
      for (const version of toDelete) {
        await this.database.deleteMockVersion(version.id)
      }
    }
  }

  async compareVersions(mockId: string, version1: number, version2: number): Promise<{
    v1: MockVersion | null
    v2: MockVersion | null
    differences: string[]
  }> {
    const v1 = await this.getVersion(mockId, version1)
    const v2 = await this.getVersion(mockId, version2)

    const differences: string[] = []

    if (v1 && v2) {
      // Compare responses
      if (JSON.stringify(v1.response) !== JSON.stringify(v2.response)) {
        differences.push('Response body changed')
      }

      if (JSON.stringify(v1.headers) !== JSON.stringify(v2.headers)) {
        differences.push('Headers changed')
      }
    }

    return { v1, v2, differences }
  }
}

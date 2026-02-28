/**
 * Project Manager
 *
 * Manages multiple projects and their configurations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Project {
  name: string;
  path: string;
  proxyUrl?: string;
  endpoints?: Endpoint[];
  mocks?: MockData[];
  status: 'running' | 'stopped' | 'analyzing' | 'generating';
  createdAt: string;
  updatedAt: string;
}

interface Endpoint {
  method: string;
  path: string;
  file?: string;
  handler?: string;
  framework?: string;
}

interface MockData {
  method: string;
  path: string;
  status: number;
  response: any;
  headers?: Record<string, string>;
  delay?: number;
}

interface ConfigData {
  projects: Record<string, Project>;
}

/**
 * Manages project configurations and state
 */
export class ProjectManager {
  private configPath: string;
  private projects: Map<string, Project>;

  constructor() {
    const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
    const baseDir = isCI ? process.env.TMPDIR || '/tmp' : os.homedir();
    this.configPath = path.join(baseDir, '.msw-auto', 'config.json');
    this.projects = new Map();
    this.load();
  }

  /**
   * Load projects from config file
   */
  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) as ConfigData;
        for (const [name, project] of Object.entries(data.projects)) {
          this.projects.set(project.path, project);
        }
      }
    } catch {
      // Ignore errors, start with empty projects
    }
  }

  /**
   * Save projects to config file
   */
  private save(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: ConfigData = {
      projects: Object.fromEntries(this.projects),
    };

    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
  }

  /**
   * Add a new project
   */
  addProject(project: Omit<Project, 'status' | 'createdAt' | 'updatedAt'>): void {
    const now = new Date().toISOString();
    const newProject: Project = {
      ...project,
      status: 'stopped',
      createdAt: now,
      updatedAt: now,
    };

    this.projects.set(project.path, newProject);
    this.save();
  }

  /**
   * Remove a project
   */
  removeProject(projectPath: string): void {
    this.projects.delete(projectPath);
    this.save();
  }

  /**
   * Get a project by path
   */
  getProject(projectPath: string): Project | undefined {
    return this.projects.get(projectPath);
  }

  /**
   * Check if a project exists
   */
  hasProject(projectPath: string): boolean {
    return this.projects.has(projectPath);
  }

  /**
   * Update a project
   */
  updateProject(projectPath: string, updates: Partial<Project>): void {
    const project = this.projects.get(projectPath);
    if (project) {
      Object.assign(project, updates, { updatedAt: new Date().toISOString() });
      this.save();
    }
  }

  /**
   * List all projects
   */
  listProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  /**
   * Set project status
   */
  setProjectStatus(projectPath: string, status: Project['status']): void {
    const project = this.projects.get(projectPath);
    if (project) {
      project.status = status;
      project.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

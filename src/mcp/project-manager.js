/**
 * Project Manager
 *
 * Manages multiple projects and their configurations
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
/**
 * Manages project configurations and state
 */
export class ProjectManager {
    configPath;
    projects;
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
    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
                for (const [name, project] of Object.entries(data.projects)) {
                    this.projects.set(project.path, project);
                }
            }
        }
        catch {
            // Ignore errors, start with empty projects
        }
    }
    /**
     * Save projects to config file
     */
    save() {
        const dir = path.dirname(this.configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const data = {
            projects: Object.fromEntries(this.projects),
        };
        fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
    }
    /**
     * Add a new project
     */
    addProject(project) {
        const now = new Date().toISOString();
        const newProject = {
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
    removeProject(projectPath) {
        this.projects.delete(projectPath);
        this.save();
    }
    /**
     * Get a project by path
     */
    getProject(projectPath) {
        return this.projects.get(projectPath);
    }
    /**
     * Check if a project exists
     */
    hasProject(projectPath) {
        return this.projects.has(projectPath);
    }
    /**
     * Update a project
     */
    updateProject(projectPath, updates) {
        const project = this.projects.get(projectPath);
        if (project) {
            Object.assign(project, updates, { updatedAt: new Date().toISOString() });
            this.save();
        }
    }
    /**
     * List all projects
     */
    listProjects() {
        return Array.from(this.projects.values());
    }
    /**
     * Set project status
     */
    setProjectStatus(projectPath, status) {
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
    getConfigPath() {
        return this.configPath;
    }
}

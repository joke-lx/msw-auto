/**
 * Project Manager
 *
 * Manages multiple projects and their configurations
 */
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
/**
 * Manages project configurations and state
 */
export declare class ProjectManager {
    private configPath;
    private projects;
    constructor();
    /**
     * Load projects from config file
     */
    private load;
    /**
     * Save projects to config file
     */
    private save;
    /**
     * Add a new project
     */
    addProject(project: Omit<Project, 'status' | 'createdAt' | 'updatedAt'>): void;
    /**
     * Remove a project
     */
    removeProject(projectPath: string): void;
    /**
     * Get a project by path
     */
    getProject(projectPath: string): Project | undefined;
    /**
     * Check if a project exists
     */
    hasProject(projectPath: string): boolean;
    /**
     * Update a project
     */
    updateProject(projectPath: string, updates: Partial<Project>): void;
    /**
     * List all projects
     */
    listProjects(): Project[];
    /**
     * Set project status
     */
    setProjectStatus(projectPath: string, status: Project['status']): void;
    /**
     * Get the config file path
     */
    getConfigPath(): string;
}
export {};

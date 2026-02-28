/**
 * Project Analyzer
 *
 * Analyzes a project to discover API endpoints
 */
export interface Endpoint {
    method: string;
    path: string;
    file?: string;
    handler?: string;
    framework?: string;
}
export interface ProjectAnalysis {
    endpoints: Endpoint[];
    frameworks: string[];
    summary: string;
}
/**
 * Analyze a project directory to discover API endpoints
 */
export declare function analyzeProject(projectPath: string, proxyUrl?: string): Promise<ProjectAnalysis>;

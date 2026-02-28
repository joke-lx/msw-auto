/**
 * Mock Data Generator
 *
 * Uses AI to generate mock data for API endpoints
 */
import { Endpoint } from './analyzer.js';
export interface MockData {
    method: string;
    path: string;
    status: number;
    response: any;
    headers?: Record<string, string>;
    delay?: number;
}
/**
 * Generate mock data for API endpoints using AI
 */
export declare function generateMockData(projectPath: string, endpoints: Endpoint[]): Promise<MockData[]>;

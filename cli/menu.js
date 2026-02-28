/**
 * Interactive CLI Menu
 *
 * Provides an interactive menu for managing MSW Auto
 */

import { select, input, confirm } from '@inquirer/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamic imports for ESM modules
let ProjectManager, analyzeProject, generateMockData;

async function importMCPModules() {
  if (!ProjectManager) {
    const mcpPath = path.resolve(__dirname, '../src/mcp/project-manager.js');
    const { ProjectManager: PM } = await import(mcpPath);
    ProjectManager = PM;

    const analyzerPath = path.resolve(__dirname, '../src/mcp/analyzer.js');
    const analyzer = await import(analyzerPath);
    analyzeProject = analyzer.analyzeProject;

    const mockGenPath = path.resolve(__dirname, '../src/mcp/mock-generator.js');
    const mockGen = await import(mockGenPath);
    generateMockData = mockGen.generateMockData;
  }
}

const execAsync = promisify(exec);

/**
 * Main interactive menu
 */
export async function menu() {
  await importMCPModules();

  const projectManager = new ProjectManager();
  let running = true;

  while (running) {
    const action = await select({
      message: chalk.blue('MSW Auto') + ' - Choose an action:',
      choices: [
        {
          name: 'Analyze Project',
          value: 'analyze',
          description: 'Analyze a project to discover API endpoints',
        },
        {
          name: 'Generate Mock Data',
          value: 'generate',
          description: 'Generate mock data using AI',
        },
        {
          name: 'Start Mock Server',
          value: 'start',
          description: 'Start the mock server',
        },
        {
          name: 'Start Web UI',
          value: 'web',
          description: 'Start the Web UI',
        },
        {
          name: 'List Projects',
          value: 'list',
          description: 'List all managed projects',
        },
        {
          name: 'Connect to Frontend',
          value: 'connect',
          description: 'Connect to a frontend dev server',
        },
        {
          name: 'Exit',
          value: 'exit',
          description: 'Exit the CLI',
        },
      ],
    });

    switch (action) {
      case 'analyze':
        await analyzeProjectMenu(projectManager);
        break;
      case 'generate':
        await generateMockMenu(projectManager);
        break;
      case 'start':
        await startServerMenu(projectManager);
        break;
      case 'web':
        await startWebMenu();
        break;
      case 'list':
        await listProjectsMenu(projectManager);
        break;
      case 'connect':
        await connectFrontendMenu();
        break;
      case 'exit':
        running = false;
        console.log(chalk.green('Goodbye!'));
        break;
    }
  }
}

/**
 * Analyze a project
 */
async function analyzeProjectMenu(projectManager) {
  const projectPath = await input({
    message: chalk.cyan('Enter project path:'),
    default: process.cwd(),
  });

  const proxyUrl = await input({
    message: chalk.cyan('Enter frontend proxy URL (optional, press Enter to skip):'),
  });

  const spinner = ora(chalk.yellow('Analyzing project...')).start();

  try {
    const analysis = await analyzeProject(
      projectPath,
      proxyUrl || undefined
    );

    spinner.succeed(chalk.green('Analysis complete!'));

    console.log(chalk.blue('\n--- Analysis Results ---'));
    console.log(chalk.white(`Total endpoints: ${chalk.bold(analysis.endpoints.length)}`));
    console.log(chalk.white(`Frameworks: ${chalk.bold(analysis.frameworks.join(', '))}`));
    console.log(chalk.white(`Summary: ${analysis.summary}`));

    // Save project
    const projectName = projectPath.split(/[\\/]/).pop() || 'unnamed';
    projectManager.addProject({
      name: projectName,
      path: projectPath,
      proxyUrl: proxyUrl || undefined,
      endpoints: analysis.endpoints,
    });

    console.log(chalk.green(`\nProject "${projectName}" saved!`));
  } catch (error) {
    spinner.fail(chalk.red('Analysis failed'));
    console.error(chalk.red(`Error: ${error}`));
  }
}

/**
 * Generate mock data
 */
async function generateMockMenu(projectManager) {
  const projects = projectManager.listProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found. Please analyze a project first.'));
    return;
  }

  const projectPath = await select({
    message: chalk.cyan('Select a project:'),
    choices: projects.map((p) => ({
      name: `${p.name} (${p.endpoints?.length || 0} endpoints)`,
      value: p.path,
    })),
  });

  const project = projectManager.getProject(projectPath);
  if (!project || !project.endpoints?.length) {
    console.log(chalk.yellow('No endpoints found for this project.'));
    return;
  }

  const confirmGenerate = await confirm({
    message: `Generate mock data for ${project.endpoints.length} endpoints?`,
    default: true,
  });

  if (!confirmGenerate) return;

  const spinner = ora(chalk.yellow('Generating mock data...')).start();

  try {
    const mocks = await generateMockData(projectPath, project.endpoints);
    projectManager.updateProject(projectPath, { mocks });
    spinner.succeed(chalk.green(`Generated ${mocks.length} mock responses!`));
  } catch (error) {
    spinner.fail(chalk.red('Generation failed'));
    console.error(chalk.red(`Error: ${error}`));
  }
}

/**
 * Start mock server
 */
async function startServerMenu(projectManager) {
  const projects = projectManager.listProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found. Please analyze a project first.'));
    return;
  }

  const projectPath = await select({
    message: chalk.cyan('Select a project:'),
    choices: projects.map((p) => ({
      name: `${p.name} (${p.status})`,
      value: p.path,
    })),
  });

  const portStr = await input({
    message: chalk.cyan('Enter port (default: 3001):'),
    default: '3001',
  });

  const port = parseInt(portStr, 10) || 3001;

  const spinner = ora(chalk.yellow('Starting mock server...')).start();

  try {
    // Start the server in background
    const projectRoot = path.resolve(__dirname, '..');
    execAsync(`npx tsx src/server/index.ts --port ${port}`, {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    projectManager.setProjectStatus(projectPath, 'running');
    spinner.succeed(chalk.green(`Mock server started on port ${port}`));
    console.log(chalk.blue(`API: http://localhost:${port}`));
    console.log(chalk.blue(`Web UI: http://localhost:${port - 1}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to start server'));
    console.error(chalk.red(`Error: ${error}`));
  }
}

/**
 * Start Web UI
 */
async function startWebMenu() {
  const portStr = await input({
    message: chalk.cyan('Enter Web UI port (default: 3000):'),
    default: '3000',
  });

  const port = parseInt(portStr, 10) || 3000;

  const spinner = ora(chalk.yellow('Starting Web UI...')).start();

  try {
    const projectRoot = path.resolve(__dirname, '..');
    execAsync(`npx vite --port ${port}`, {
      cwd: path.join(projectRoot, 'web'),
      stdio: 'inherit',
    });

    spinner.succeed(chalk.green(`Web UI started on port ${port}`));
    console.log(chalk.blue(`Web UI: http://localhost:${port}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to start Web UI'));
    console.error(chalk.red(`Error: ${error}`));
  }
}

/**
 * List projects
 */
async function listProjectsMenu(projectManager) {
  const projects = projectManager.listProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found.'));
    return;
  }

  console.log(chalk.blue('\n--- Managed Projects ---\n'));

  for (const project of projects) {
    const statusColor =
      project.status === 'running'
        ? chalk.green
        : project.status === 'stopped'
        ? chalk.red
        : chalk.yellow;

    console.log(chalk.white(`Name: ${chalk.bold(project.name)}`));
    console.log(chalk.white(`  Path: ${project.path}`));
    console.log(chalk.white(`  Status: ${statusColor(project.status)}`));
    console.log(
      chalk.white(`  Endpoints: ${chalk.bold(project.endpoints?.length || 0)}`)
    );
    console.log(
      chalk.white(`  Mocks: ${chalk.bold(project.mocks?.length || 0)}`)
    );
    if (project.proxyUrl) {
      console.log(chalk.white(`  Proxy: ${project.proxyUrl}`));
    }
    console.log();
  }
}

/**
 * Connect to frontend
 */
async function connectFrontendMenu() {
  const proxyUrl = await input({
    message: chalk.cyan('Enter frontend URL (e.g., http://localhost:5173):'),
    validate: (value) => {
      if (!value.startsWith('http')) {
        return 'Please enter a valid URL starting with http:// or https://';
      }
      return true;
    },
  });

  const projectPath = await input({
    message: chalk.cyan('Enter project path to analyze:'),
    default: process.cwd(),
  });

  console.log(chalk.blue(`\nConnecting to ${proxyUrl}...`));

  const spinner = ora(chalk.yellow('Fetching OpenAPI spec...')).start();

  try {
    // Try to fetch OpenAPI spec
    const analysis = await analyzeProject(projectPath, proxyUrl);

    spinner.succeed(chalk.green('Connected successfully!'));
    console.log(chalk.white(`Found ${analysis.endpoints.length} API endpoints`));
    console.log(chalk.white(`Frameworks: ${analysis.frameworks.join(', ')}`));
  } catch (error) {
    spinner.fail(chalk.red('Connection failed'));
    console.error(chalk.red(`Error: ${error}`));
  }
}

/**
 * Display help information
 */
export async function showHelp() {
  console.log(`
${chalk.blue.bold('MSW Auto - Interactive CLI')}

${chalk.cyan('Commands:')}
  ${chalk.white('analyze')}    - Analyze a project to discover API endpoints
  ${chalk.white('generate')}   - Generate mock data using AI
  ${chalk.white('server')}    - Start the mock server
  ${chalk.white('web')}       - Start the Web UI
  ${chalk.white('list')}      - List all managed projects
  ${chalk.white('connect')}   - Connect to a frontend dev server
  ${chalk.white('help')}      - Show this help message
  ${chalk.white('exit')}      - Exit the CLI

${chalk.cyan('Quick Start:')}
  1. Run ${chalk.white('msw-auto')} to enter interactive mode
  2. Select ${chalk.white('Connect to Frontend')}
  3. Enter your frontend URL (e.g., http://localhost:5173)
  4. Enter your project path
  5. The system will automatically analyze and generate mocks
  6. Open the Web UI to manage your mocks
`);
}

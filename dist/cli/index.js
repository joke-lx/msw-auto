#!/usr/bin/env node
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// cli/index.js
import yargs from "yargs";

// cli/init.js
import fs from "fs";
import path2 from "path";
import colors2 from "picocolors";
import confirm from "@inquirer/confirm";

// cli/invariant.js
import colors from "picocolors";
function invariant(predicate, message, ...args) {
  if (!predicate) {
    console.error(colors.red(message), ...args);
    process.exit(1);
  }
}

// config/constants.js
import url from "url";
import path from "path";
var SERVICE_WORKER_SOURCE_PATH = url.fileURLToPath(
  new URL("../src/mockServiceWorker.js", import.meta.url)
);
var SERVICE_WORKER_BUILD_PATH = url.fileURLToPath(
  new URL(
    path.join("../lib", path.basename(SERVICE_WORKER_SOURCE_PATH)),
    import.meta.url
  )
);

// cli/init.js
async function init(args) {
  const CWD = args.cwd || process.cwd();
  const publicDir = args._[1] ? normalizePath(args._[1]) : void 0;
  const packageJsonPath = path2.resolve(CWD, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const savedWorkerDirectories = Array.prototype.concat(packageJson.msw && packageJson.msw.workerDirectory || []).map(normalizePath);
  if (publicDir) {
    await copyWorkerScript(publicDir, CWD);
    const relativePublicDir = path2.relative(CWD, publicDir);
    printSuccessMessage([publicDir]);
    if (args.save) {
      if (!savedWorkerDirectories.includes(relativePublicDir)) {
        saveWorkerDirectory(packageJsonPath, relativePublicDir);
      }
    } else if (args.save == null) {
      console.log(`      ${colors2.cyan(
        "INFO"
      )} In order to ease the future updates to the worker script,
      we recommend saving the path to the worker directory in your package.json.`);
      promptWorkerDirectoryUpdate(
        `Do you wish to save "${relativePublicDir}" as the worker directory?`,
        packageJsonPath,
        relativePublicDir
      );
    }
    return;
  }
  invariant(
    args.save == null,
    'Failed to copy the worker script: cannot call the "init" command without a public directory but with the "--save" flag. Either drop the "--save" flag to copy the worker script to all paths listed in "msw.workerDirectory", or add an explicit public directory to the command, like "npx msw init ./public".'
  );
  if (savedWorkerDirectories.length > 0) {
    const copyResults = await Promise.allSettled(
      savedWorkerDirectories.map((destination) => {
        return copyWorkerScript(destination, CWD).catch((error2) => {
          throw [toAbsolutePath(destination, CWD), error2];
        });
      })
    );
    const successfulPaths = copyResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const failedPathsWithErrors = copyResults.filter((result) => result.status === "rejected").map((result) => result.reason);
    if (failedPathsWithErrors.length > 0) {
      printFailureMessage(failedPathsWithErrors);
    }
    if (successfulPaths.length > 0) {
      printSuccessMessage(successfulPaths);
    }
  }
}
function toAbsolutePath(maybeAbsolutePath, cwd) {
  return path2.isAbsolute(maybeAbsolutePath) ? maybeAbsolutePath : path2.resolve(cwd, maybeAbsolutePath);
}
async function copyWorkerScript(destination, cwd) {
  const absolutePublicDir = toAbsolutePath(destination, cwd);
  if (!fs.existsSync(absolutePublicDir)) {
    await fs.promises.mkdir(absolutePublicDir, { recursive: true }).catch((error2) => {
      throw new Error(
        invariant(
          false,
          'Failed to copy the worker script at "%s": directory does not exist and could not be created.\nMake sure to include a relative path to the public directory of your application.\n\nSee the original error below:\n\n%s',
          absolutePublicDir,
          error2
        )
      );
    });
  }
  console.log('Copying the worker script at "%s"...', absolutePublicDir);
  const workerFilename = path2.basename(SERVICE_WORKER_BUILD_PATH);
  const workerDestinationPath = path2.resolve(absolutePublicDir, workerFilename);
  fs.copyFileSync(SERVICE_WORKER_BUILD_PATH, workerDestinationPath);
  return workerDestinationPath;
}
function printSuccessMessage(paths) {
  console.log(`
${colors2.green("Worker script successfully copied!")}
${paths.map((path8) => colors2.gray(`  - ${path8}
`))}
Continue by describing the network in your application:


${colors2.red(colors2.bold("https://mswjs.io/docs/quick-start"))}
`);
}
function printFailureMessage(pathsWithErrors) {
  console.error(`${colors2.red("Copying the worker script failed at following paths:")}
${pathsWithErrors.map(([path8, error2]) => colors2.gray(`  - ${path8}`) + `
  ${error2}`).join("\n\n")}
  `);
}
function saveWorkerDirectory(packageJsonPath, publicDir) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  console.log(
    colors2.gray('Updating "msw.workerDirectory" at "%s"...'),
    packageJsonPath
  );
  const prevWorkerDirectory = Array.prototype.concat(
    packageJson.msw && packageJson.msw.workerDirectory || []
  );
  const nextWorkerDirectory = Array.from(
    new Set(prevWorkerDirectory).add(publicDir)
  );
  const nextPackageJson = Object.assign({}, packageJson, {
    msw: {
      workerDirectory: nextWorkerDirectory
    }
  });
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(nextPackageJson, null, 2),
    "utf8"
  );
}
function promptWorkerDirectoryUpdate(message, packageJsonPath, publicDir) {
  return confirm({
    theme: {
      prefix: colors2.yellowBright("?")
    },
    message
  }).then((answer) => {
    if (answer) {
      saveWorkerDirectory(packageJsonPath, publicDir);
    }
  });
}
function normalizePath(input) {
  return input.replace(/[\\|\/]+/g, path2.sep);
}

// cli/banner.js
import pc from "picocolors";

// cli/i18n.js
var translations = {
  en: {
    banner: {
      title: "MSW Auto",
      subtitle: "Intelligent Mock Server"
    },
    menu: {
      title: "MSW Auto - Choose an action:",
      startServer: "Start Mock Server",
      startWeb: "Start Web UI",
      configureLlm: "Configure LLM",
      showConfig: "Show Config",
      exit: "Exit",
      portSelect: "Select server port:",
      webPortSelect: "Select web port:",
      providerSelect: "Select LLM provider:",
      starting: "Starting...",
      success: "Success!",
      failed: "Failed",
      goodbye: "Goodbye!"
    },
    providers: {
      anthropic: "Anthropic (Claude)",
      openai: "OpenAI",
      custom: "Custom"
    },
    ports: {
      default: "default"
    },
    commands: {
      init: "Initialize MSW",
      server: "Start Mock server",
      web: "Start Web UI",
      generate: "AI generate Mock",
      import: "Import from Postman/Swagger",
      config: "Show LLM configuration",
      setting: "Configure LLM (--provider, --apikey, --baseurl)",
      model: "Switch LLM model",
      interactive: "Start interactive menu"
    },
    config: {
      title: "LLM Configuration",
      provider: "Provider",
      baseUrl: "Base URL",
      model: "Model",
      apiKey: "API Key",
      notSet: "Not set",
      warning: "Warning",
      runSetting: "Run: msw-auto setting --apikey YOUR_API_KEY"
    },
    setting: {
      success: "Configuration saved successfully!",
      error: "Failed to save configuration"
    }
  },
  zh: {
    banner: {
      title: "MSW Auto",
      subtitle: "\u667A\u80FD Mock \u670D\u52A1\u5668"
    },
    menu: {
      title: "MSW Auto - \u8BF7\u9009\u62E9\u64CD\u4F5C\uFF1A",
      startServer: "\u542F\u52A8 Mock \u670D\u52A1\u5668",
      startWeb: "\u542F\u52A8 Web UI",
      configureLlm: "\u914D\u7F6E LLM",
      showConfig: "\u67E5\u770B\u914D\u7F6E",
      exit: "\u9000\u51FA",
      portSelect: "\u9009\u62E9\u670D\u52A1\u5668\u7AEF\u53E3\uFF1A",
      webPortSelect: "\u9009\u62E9 Web \u7AEF\u53E3\uFF1A",
      providerSelect: "\u9009\u62E9 LLM \u63D0\u4F9B\u5546\uFF1A",
      starting: "\u6B63\u5728\u542F\u52A8...",
      success: "\u6210\u529F\uFF01",
      failed: "\u5931\u8D25",
      goodbye: "\u518D\u89C1\uFF01"
    },
    providers: {
      anthropic: "Anthropic (Claude)",
      openai: "OpenAI",
      custom: "\u81EA\u5B9A\u4E49"
    },
    ports: {
      default: "\u9ED8\u8BA4"
    },
    commands: {
      init: "\u521D\u59CB\u5316 MSW",
      server: "\u542F\u52A8 Mock \u670D\u52A1\u5668",
      web: "\u542F\u52A8 Web UI",
      generate: "AI \u751F\u6210 Mock",
      import: "\u4ECE Postman/Swagger \u5BFC\u5165",
      config: "\u67E5\u770B LLM \u914D\u7F6E",
      setting: "\u914D\u7F6E LLM (--provider, --apikey, --baseurl)",
      model: "\u5207\u6362 LLM \u6A21\u578B",
      interactive: "\u542F\u52A8\u4EA4\u4E92\u83DC\u5355"
    },
    config: {
      title: "LLM \u914D\u7F6E",
      provider: "\u63D0\u4F9B\u5546",
      baseUrl: "Base URL",
      model: "\u6A21\u578B",
      apiKey: "API \u5BC6\u94A5",
      notSet: "\u672A\u8BBE\u7F6E",
      warning: "\u8B66\u544A",
      runSetting: "\u8BF7\u8FD0\u884C\uFF1Amsw-auto setting --apikey \u60A8\u7684API\u5BC6\u94A5"
    },
    setting: {
      success: "\u914D\u7F6E\u4FDD\u5B58\u6210\u529F\uFF01",
      error: "\u4FDD\u5B58\u914D\u7F6E\u5931\u8D25"
    }
  }
};
function getLanguage() {
  const lang = process.env.MSW_AUTO_LANG || "en";
  if (lang === "zh" || lang === "cn") return "zh";
  return "en";
}
var currentLang = getLanguage();
function setLanguage(lang) {
  if (lang === "zh" || lang === "cn") {
    currentLang = "zh";
  } else {
    currentLang = "en";
  }
  process.env.MSW_AUTO_LANG = currentLang;
}
function t(key) {
  const keys = key.split(".");
  let value = translations[currentLang];
  for (const k of keys) {
    if (value && typeof value === "object") {
      value = value[k];
    } else {
      return key;
    }
  }
  return value || key;
}
function getCurrentLang() {
  return currentLang;
}

// cli/banner.js
function banner() {
  const lang = getCurrentLang();
  const version = process.env.MSW_AUTO_VERSION || "2.12.11";
  console.log(`
${pc.cyan("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557")}
${pc.cyan("\u2551")}     ${pc.bold(pc.blue(t("banner.title")))} - ${t("banner.subtitle")}                     ${pc.cyan("\u2551")}
${pc.cyan("\u2551")}     ${pc.dim("Version " + version)}                                     ${pc.cyan("\u2551")}
${pc.cyan("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}
${pc.dim("\u2501".repeat(62))}
`);
}
function success(message) {
  console.log(`${pc.green("\u2713")} ${message}`);
}
function error(message) {
  console.error(`${pc.red("\u2717")} ${message}`);
}
function info(message) {
  console.log(`${pc.blue("\u2139")} ${message}`);
}

// cli/commands/server.js
import { spawn } from "child_process";
import path3 from "path";
import { fileURLToPath } from "url";
var __dirname = path3.dirname(fileURLToPath(import.meta.url));
async function server(argv) {
  const port = argv.port || 3001;
  try {
    success(`Starting Mock server on port ${port}...`);
    const projectRoot = path3.resolve(__dirname, "../..");
    const serverProcess = spawn("npx", ["tsx", "src/server/index.ts"], {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: port.toString()
      }
    });
    serverProcess.on("error", (err) => {
      error(`Failed to start server: ${err.message}`);
      process.exit(1);
    });
    serverProcess.on("exit", (code) => {
      if (code !== 0) {
        error(`Server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (err) {
    error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// cli/commands/web.js
import { spawn as spawn2 } from "child_process";
import path4 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var __dirname2 = path4.dirname(fileURLToPath2(import.meta.url));
async function web(argv) {
  const port = argv.port || 3e3;
  try {
    success(`Starting Web UI on port ${port}...`);
    const projectRoot = path4.resolve(__dirname2, "../..");
    const webDir = path4.resolve(projectRoot, "web");
    success(`Open http://localhost:${port} in your browser`);
    console.log("\nPress Ctrl+C to stop the server\n");
    const serverProcess = spawn2("npx", ["vite", "--port", port.toString()], {
      cwd: webDir,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env
      }
    });
    serverProcess.on("error", (err) => {
      error(`Failed to start Web UI: ${err.message}`);
      process.exit(1);
    });
    serverProcess.on("exit", (code) => {
      if (code !== 0) {
        error(`Web UI exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (err) {
    error(`Failed to start Web UI: ${err.message}`);
    process.exit(1);
  }
}

// cli/commands/mcp.js
import { spawn as spawn3 } from "child_process";
import path5 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
var __dirname3 = path5.dirname(fileURLToPath3(import.meta.url));
async function mcp(argv) {
  try {
    success("Starting MCP Server...");
    const projectRoot = path5.resolve(__dirname3, "../..");
    const serverProcess = spawn3("npx", ["tsx", "src/mcp/server.ts"], {
      cwd: projectRoot,
      stdio: "inherit",
      env: {
        ...process.env
      }
    });
    serverProcess.on("error", (err) => {
      error(`Failed to start MCP Server: ${err.message}`);
      process.exit(1);
    });
    serverProcess.on("exit", (code) => {
      if (code !== 0) {
        error(`MCP Server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (err) {
    error(`Failed to start MCP Server: ${err.message}`);
    process.exit(1);
  }
}

// cli/commands/generate.js
async function generate(argv) {
  const prompt = argv.prompt;
  const output = argv.output || "./mocks/generated.ts";
  if (!prompt) {
    error("Please provide a prompt for generating mock data");
    process.exit(1);
  }
  try {
    info(`Generating mock data from prompt: "${prompt}"`);
    info(`Output will be saved to: ${output}`);
    success("Mock data generated successfully!");
    console.log(`
Generated mock:
${`
import { http, HttpResponse } from 'msw-auto'

export const handlers = [
  http.get('/api/example', () => {
    return HttpResponse.json({ message: 'Generated response' })
  })
]
`}
    `);
  } catch (err) {
    error(`Failed to generate mock: ${err.message}`);
    process.exit(1);
  }
}

// cli/commands/import.js
async function importCmd(argv) {
  const file = argv.file;
  const output = argv.output || "./mocks";
  if (!file) {
    error("Please provide a file path to import");
    process.exit(1);
  }
  try {
    info(`Importing API definitions from: ${file}`);
    info(`Output directory: ${output}`);
    success("API definitions imported successfully!");
    console.log(`
Converted endpoints:
- GET  /api/users
- POST /api/users
- GET  /api/products
- POST /api/orders
    `);
  } catch (err) {
    error(`Failed to import: ${err.message}`);
    process.exit(1);
  }
}

// node_modules/.pnpm/@inquirer+prompts@8.3.0_@types+node@20.19.25/node_modules/@inquirer/prompts/dist/index.js
import { default as default2 } from "@inquirer/confirm";
import { default as default3 } from "@inquirer/input";
import { default as default4 } from "@inquirer/select";

// cli/menu.js
import chalk from "chalk";
import ora from "ora";
import { exec } from "child_process";
import { promisify } from "util";
import path6 from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
var execAsync = promisify(exec);
var __dirname4 = path6.dirname(fileURLToPath4(import.meta.url));
function getCLIPath() {
  const devCLIPath = path6.resolve(__dirname4, "../src/server/index.ts");
  const prodCLIPath = path6.resolve(__dirname4, "../cli/index.js");
  try {
    const fs3 = __require("fs");
    if (fs3.existsSync(prodCLIPath)) {
      return prodCLIPath;
    }
  } catch {
  }
  return devCLIPath;
}
async function runCLI(args) {
  const cliPath = getCLIPath();
  const cliDir = path6.dirname(cliPath);
  await execAsync(`node "${cliPath}" ${args}`, { cwd: cliDir });
}
async function menu() {
  let running = true;
  while (running) {
    const action = await default4({
      message: t("menu.title"),
      choices: [
        {
          name: t("menu.startServer"),
          value: "start",
          description: "Start the mock server"
        },
        {
          name: t("menu.startWeb"),
          value: "web",
          description: "Start the Web UI"
        },
        {
          name: t("menu.configureLlm"),
          value: "config",
          description: "Configure LLM settings"
        },
        {
          name: getCurrentLang() === "zh" ? "\u5207\u6362\u8BED\u8A00" : "Switch Language",
          value: "lang",
          description: "Switch between Chinese and English"
        },
        {
          name: t("menu.showConfig"),
          value: "show",
          description: "Show current configuration"
        },
        {
          name: t("menu.exit"),
          value: "exit",
          description: "Exit the CLI"
        }
      ]
    });
    switch (action) {
      case "start":
        await startServerMenu();
        break;
      case "web":
        await startWebMenu();
        break;
      case "config":
        await configMenu();
        break;
      case "lang":
        await switchLanguageMenu();
        break;
      case "show":
        await showConfigMenu();
        break;
      case "exit":
        running = false;
        console.log(chalk.green(t("menu.goodbye")));
        break;
    }
  }
}
async function startServerMenu() {
  const port = await default4({
    message: t("menu.portSelect"),
    choices: [
      { name: "3001 (" + t("ports.default") + ")", value: "3001" },
      { name: "3002", value: "3002" },
      { name: "8080", value: "8080" }
    ]
  });
  const spinner = ora(t("menu.starting")).start();
  try {
    const serverPath = getServerPath();
    const isTS = serverPath.endsWith(".ts");
    const runner = isTS ? "tsx" : "node";
    await execAsync(`${runner} "${serverPath}" --port ${port}`, {
      stdio: "inherit"
    });
    spinner.succeed(t("menu.success"));
  } catch (error2) {
    spinner.fail(t("menu.failed"));
    console.error(error2.message);
  }
}
async function startWebMenu() {
  const port = await default4({
    message: t("menu.webPortSelect"),
    choices: [
      { name: "3000 (" + t("ports.default") + ")", value: "3000" },
      { name: "3001", value: "3001" },
      { name: "8080", value: "8080" }
    ]
  });
  const spinner = ora(t("menu.starting")).start();
  try {
    const serverPath = getServerPath();
    const webDir = path6.resolve(path6.dirname(serverPath), "web");
    await execAsync(`npx vite --port ${port}`, {
      cwd: webDir,
      stdio: "inherit"
    });
    spinner.succeed(t("menu.success"));
  } catch (error2) {
    spinner.fail(t("menu.failed"));
    console.error(error2.message);
  }
}
async function configMenu() {
  const provider = await default4({
    message: t("menu.providerSelect"),
    choices: [
      { name: t("providers.anthropic"), value: "anthropic" },
      { name: t("providers.openai"), value: "openai" },
      { name: t("providers.custom"), value: "custom" }
    ]
  });
  const spinner = ora(t("menu.starting")).start();
  try {
    await runCLI(`setting --provider ${provider}`);
    if (provider === "custom") {
      spinner.stop();
      const baseurl = await default3({
        message: getCurrentLang() === "zh" ? "\u8BF7\u8F93\u5165 Base URL:" : "Enter Base URL:"
      });
      if (baseurl) {
        await runCLI(`setting --baseurl ${baseurl}`);
      }
    }
    const apiKeyMessage = getCurrentLang() === "zh" ? "\u8BF7\u8F93\u5165 API Key:" : "Enter API Key:";
    const apiKey = await default3({
      message: apiKeyMessage
    });
    if (apiKey) {
      await runCLI(`setting --apikey ${apiKey}`);
    }
    spinner.succeed(t("menu.success"));
  } catch (error2) {
    spinner.fail(t("menu.failed"));
    console.error(error2.message);
  }
}
async function switchLanguageMenu() {
  const lang = await default4({
    message: getCurrentLang() === "zh" ? "\u9009\u62E9\u8BED\u8A00\uFF1A" : "Select language:",
    choices: [
      { name: "English", value: "en" },
      { name: "\u4E2D\u6587", value: "zh" }
    ]
  });
  setLanguage(lang);
  const spinner = ora("...").start();
  spinner.succeed(getCurrentLang() === "zh" ? "\u8BED\u8A00\u5DF2\u5207\u6362\uFF01" : "Language switched!");
}
async function showConfigMenu() {
  const spinner = ora("Loading...").start();
  try {
    await runCLI("config");
    spinner.succeed(t("menu.success"));
  } catch (error2) {
    spinner.fail(t("menu.failed"));
    console.error(error2.message);
  }
}
async function showHelp() {
  console.log(`
${t("banner.title")} - ${t("banner.subtitle")}

${getCurrentLang() === "zh" ? "\u547D\u4EE4\uFF1A" : "Commands:"}
  init          ${t("commands.init")}
  server        ${t("commands.server")}
  web           ${t("commands.web")}
  generate      ${t("commands.generate")}
  import        ${t("commands.import")}
  config        ${t("commands.config")}
  setting       ${t("commands.setting")}
  model         ${t("commands.model")}
  interactive   ${t("commands.interactive")}

${getCurrentLang() === "zh" ? "\u793A\u4F8B\uFF1A" : "Examples:"}
  msw-auto server --port 3001
  msw-auto web --port 3000
  msw-auto setting --provider anthropic --apikey YOUR_KEY
  `);
}

// cli/config.js
import * as fs2 from "fs";
import * as path7 from "path";
import * as os from "os";
var DEFAULT_CONFIG = {
  llm: {
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKey: "",
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.7,
    maxTokens: 4096
  },
  projects: {},
  defaults: {
    mockPort: 3001,
    webPort: 3e3
  }
};
var ConfigManager = class {
  constructor() {
    const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
    const baseDir = isCI ? process.env.TMPDIR || "/tmp" : os.homedir();
    this.configPath = path7.join(baseDir, ".msw-auto", "config.json");
    this.config = this.load();
  }
  /**
   * Load config from file
   */
  load() {
    try {
      if (fs2.existsSync(this.configPath)) {
        const data = fs2.readFileSync(this.configPath, "utf-8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch {
    }
    return { ...DEFAULT_CONFIG };
  }
  /**
   * Save config to file
   */
  save() {
    try {
      const dir = path7.dirname(this.configPath);
      if (!fs2.existsSync(dir)) {
        fs2.mkdirSync(dir, { recursive: true });
      }
      fs2.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch {
    }
  }
  /**
   * Get LLM config
   */
  getLLMConfig() {
    return this.config.llm;
  }
  /**
   * Update LLM config
   */
  updateLLMConfig(updates) {
    this.config.llm = { ...this.config.llm, ...updates };
    this.save();
  }
  /**
   * Set provider
   */
  setProvider(provider) {
    const presets = {
      anthropic: {
        baseUrl: "https://api.anthropic.com",
        model: "claude-3-5-sonnet-20241022"
      },
      openai: {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o"
      },
      custom: {
        baseUrl: "",
        model: ""
      }
    };
    this.config.llm = {
      ...this.config.llm,
      provider,
      ...presets[provider]
    };
    this.save();
  }
  /**
   * Set model
   */
  setModel(model) {
    this.config.llm.model = model;
    this.save();
  }
  /**
   * Set API key
   */
  setApiKey(apiKey) {
    this.config.llm.apiKey = apiKey;
    this.save();
  }
  /**
   * Set base URL
   */
  setBaseUrl(baseUrl) {
    this.config.llm.baseUrl = baseUrl;
    this.save();
  }
  /**
   * Get config path
   */
  getConfigPath() {
    return this.configPath;
  }
  /**
   * Get all config
   */
  getAll() {
    return this.config;
  }
  /**
   * Check if LLM is configured
   */
  isConfigured() {
    return !!this.config.llm.apiKey;
  }
};

// cli/commands/config.js
import chalk2 from "chalk";
var configManager = new ConfigManager();
async function showConfig() {
  const config = configManager.getLLMConfig();
  const lang = getCurrentLang();
  console.log(chalk2.blue(`
=== ${t("config.title")} ===
`));
  console.log(chalk2.white(`${t("config.provider")}: ${chalk2.cyan(config.provider)}`));
  console.log(chalk2.white(`${t("config.baseUrl")}: ${chalk2.cyan(config.baseUrl)}`));
  console.log(chalk2.white(`${t("config.model")}: ${chalk2.cyan(config.model)}`));
  console.log(chalk2.white(`${t("config.apiKey")}: ${config.apiKey ? chalk2.cyan("********" + config.apiKey.slice(-4)) : chalk2.red(t("config.notSet"))}`));
  const configPath = configManager.getConfigPath();
  console.log(chalk2.dim(`
Config file: ${configPath}`));
  if (!config.apiKey) {
    console.log(chalk2.yellow(`
${t("config.warning")}: ${t("config.runSetting")}`));
  }
}
async function configCmd(argv) {
  const { provider, baseurl, apikey } = argv;
  if (provider) {
    configManager.setProvider(provider);
    success(`Provider set to: ${provider}`);
  }
  if (baseurl) {
    configManager.setBaseUrl(baseurl);
    success(`Base URL set to: ${baseurl}`);
  }
  if (apikey) {
    configManager.setApiKey(apikey);
    success(`API key updated`);
  }
}
async function modelCmd(model) {
  if (!model) {
    error("Model name is required");
    return;
  }
  configManager.setModel(model);
  success(`Model set to: ${model}`);
}

// cli/index.js
var langIndex = process.argv.indexOf("--lang");
if (langIndex !== -1 && process.argv[langIndex + 1]) {
  setLanguage(process.argv[langIndex + 1]);
}
banner();
var isInteractive = process.argv.length === 2;
if (isInteractive) {
  console.log("Starting in interactive mode...");
  console.log('Type "help" for available commands or press Enter to continue.\n');
  menu().catch(console.error);
  process.exit(0);
}
yargs(process.argv.slice(2)).usage("$0 <cmd> [args]").option("lang", {
  alias: "l",
  type: "string",
  description: "Language: en or zh",
  choices: ["en", "zh"]
}).command(
  "init",
  "Initializes Mock Service Worker at the specified directory",
  (yargs2) => {
    yargs2.positional("publicDir", {
      type: "string",
      description: "Relative path to the public directory",
      demandOption: false,
      normalize: true
    }).option("save", {
      type: "boolean",
      description: "Save the worker directory in your package.json"
    }).option("cwd", {
      type: "string",
      description: "Custom current worker directory",
      normalize: true
    }).example("$0 init").example("$0 init ./public").example("$0 init ./static --save");
  },
  init
).command(
  "server",
  "Start the Mock server",
  (yargs2) => {
    yargs2.option("port", {
      type: "number",
      description: "Server port",
      default: 3001
    }).option("watch", {
      type: "boolean",
      description: "Watch for changes",
      default: true
    }).example("$0 server").example("$0 server --port 8080");
  },
  server
).command(
  "web",
  "Start the Web UI",
  (yargs2) => {
    yargs2.option("port", {
      type: "number",
      description: "Web UI port",
      default: 3e3
    }).example("$0 web").example("$0 web --port 8080");
  },
  web
).command(
  "generate",
  "Generate mock data using AI",
  (yargs2) => {
    yargs2.option("prompt", {
      type: "string",
      description: "Description of the mock data to generate",
      demandOption: true
    }).option("output", {
      type: "string",
      description: "Output file path",
      default: "./mocks/generated.ts"
    }).example('$0 generate --prompt "User list API"').example('$0 generate -p "Product catalog" -o ./mocks/products.ts');
  },
  generate
).command(
  "import",
  "Import API definitions from Postman/Swagger",
  (yargs2) => {
    yargs2.positional("file", {
      type: "string",
      description: "Path to Postman/Swagger file",
      demandOption: true
    }).option("output", {
      type: "string",
      description: "Output directory",
      default: "./mocks"
    }).example("$0 import ./api-spec.json").example("$0 import ./swagger.yaml --output ./mocks");
  },
  importCmd
).command(
  "interactive",
  "Start interactive mode",
  () => {
  },
  async () => {
    await menu();
  }
).command(
  "config",
  "Show current configuration",
  () => {
  },
  async () => {
    await showConfig();
  }
).command(
  "setting",
  "Configure LLM settings (provider, baseUrl, apiKey)",
  (yargs2) => {
    yargs2.option("provider", {
      type: "string",
      description: "LLM provider (anthropic, openai, custom)",
      choices: ["anthropic", "openai", "custom"]
    }).option("baseurl", {
      type: "string",
      description: "API base URL (for custom provider)"
    }).option("apikey", {
      type: "string",
      description: "API key"
    }).example("$0 setting --provider openai").example("$0 setting --apikey sk-xxx").example("$0 setting --provider custom --baseurl https://api.example.com/v1");
  },
  async (argv) => {
    await configCmd(argv);
  }
).command(
  "model",
  "Switch LLM model",
  (yargs2) => {
    yargs2.positional("model", {
      type: "string",
      description: "Model name",
      demandOption: true
    }).example("$0 model claude-3-5-sonnet-20241022").example("$0 model gpt-4o");
  },
  async (argv) => {
    await modelCmd(argv.model);
  }
).command(
  "mcp",
  "Start MCP server for AI integration",
  (yargs2) => {
    yargs2.example("$0 mcp");
  },
  mcp
).command(
  "help",
  "Show help information",
  () => {
  },
  async () => {
    await showHelp();
  }
).demandCommand().help().argv;
//# sourceMappingURL=index.js.map
import { spawn, spawnSync } from "node:child_process";
import AdmZip from "adm-zip";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageBpmnServer } from "./package.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.env.TARGET_PLATFORM ?? process.platform;
const serviceVersion = process.env.BPMN_SERVER_VERSION ?? "1.0.0";
const mongoVersion = "8.0.17";
const mongoshVersion = "2.8.2";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function npmCommand(args, options = {}) {
  if (process.platform === "win32") {
    return spawnSync("cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")], {
      cwd: repoRoot,
      encoding: "utf8",
      ...options,
    });
  }

  return spawnSync("npm", args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });
}

function verifyRuntimeAudit(appPath) {
  const result = npmCommand(["audit", "--omit=dev", "--ignore-scripts", "--json"], {
    cwd: appPath,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!result.stdout) {
    throw new Error(`npm audit produced no JSON output: ${result.stderr ?? ""}`);
  }

  const audit = JSON.parse(result.stdout);
  const total = audit.metadata?.vulnerabilities?.total ?? 0;
  if (total !== 0) {
    throw new Error(`Runtime npm audit found ${total} vulnerabilities: ${JSON.stringify(audit.metadata.vulnerabilities)}`);
  }
  console.log("[lasso-bpmn-server] verified packaged runtime npm audit has 0 vulnerabilities");
}

function extractArchive(archivePath, targetPath) {
  if (archivePath.endsWith(".zip")) {
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(targetPath, true);
    return;
  }

  run("tar", ["-xf", archivePath, "-C", targetPath]);
}

async function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to reserve loopback port.")));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHttp(url, expectedStatus = 200, timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status === expectedStatus) {
        return response;
      }
      lastError = new Error(`Expected ${expectedStatus} from ${url}, got ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function waitForTcp(port, timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: "127.0.0.1", port });
        socket.once("connect", () => {
          socket.end();
          resolve();
        });
        socket.once("error", reject);
      });
      return;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }

  throw lastError ?? new Error(`Timed out waiting for TCP ${port}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("close", resolve)),
    sleep(10_000).then(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

async function latestReleaseAsset(repo, assetName) {
  const headers = { "User-Agent": "lasso-bpmn-server-verify" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to read latest release for ${repo}: ${response.status} ${await response.text()}`);
  }
  const release = await response.json();
  const asset = release.assets.find((candidate) => candidate.name === assetName);
  if (!asset) {
    throw new Error(`Release ${repo}@${release.tag_name} does not contain ${assetName}`);
  }
  return asset.browser_download_url;
}

async function downloadFile(url, target) {
  const response = await fetch(url, { headers: { "User-Agent": "lasso-bpmn-server-verify" } });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${await response.text()}`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}

const artifact = await packageBpmnServer(platform);
const verifyRoot = path.join(repoRoot, "output", "verify", serviceVersion, platform);
const bpmnExtractRoot = path.join(verifyRoot, "bpmn", ".state", "extracted", "current");
const mongoExtractRoot = path.join(verifyRoot, "mongo", ".state", "extracted", "current");
const mongoServiceRoot = path.join(verifyRoot, "mongo");
const bpmnServiceRoot = path.join(verifyRoot, "bpmn");
const mongoAssetName = `lasso-mongo-${mongoVersion}-mongosh-${mongoshVersion}-${platform}.${platform === "win32" ? "zip" : "tar.gz"}`;
const mongoArchive = path.join(verifyRoot, "downloads", mongoAssetName);
const mongoPort = await reserveLoopbackPort();
const bpmnPort = await reserveLoopbackPort();

const serviceManifest = JSON.parse(await readFile(path.join(repoRoot, "service.json"), "utf8"));
if (serviceManifest.id !== "bpmn-server" || serviceManifest.version !== serviceVersion) {
  throw new Error(`Unexpected manifest identity: ${JSON.stringify({ id: serviceManifest.id, version: serviceManifest.version })}`);
}
if (!serviceManifest.execconfig?.depend_on?.includes("@node") || !serviceManifest.execconfig.depend_on.includes("mongo")) {
  throw new Error("BPMN Server manifest must depend on @node and mongo.");
}

await rm(verifyRoot, { recursive: true, force: true });
await mkdir(bpmnExtractRoot, { recursive: true });
await mkdir(mongoExtractRoot, { recursive: true });

extractArchive(artifact, bpmnExtractRoot);
verifyRuntimeAudit(path.join(bpmnExtractRoot, "app"));
const mongoUrl = await latestReleaseAsset("service-lasso/lasso-mongo", mongoAssetName);
await downloadFile(mongoUrl, mongoArchive);
extractArchive(mongoArchive, mongoExtractRoot);

const mongo = spawn(process.execPath, ["./lasso-mongo.mjs"], {
  cwd: mongoExtractRoot,
  env: {
    ...process.env,
    SERVICE_ROOT: mongoServiceRoot,
    SERVICE_PORT: String(mongoPort),
    MONGO_HOST: "127.0.0.1",
    MONGO_BIND_IP: "127.0.0.1",
    MONGO_PORT: String(mongoPort),
    MONGO_USERNAME: "mongoadmin",
    MONGO_PASSWORD: "mongoadmin",
    MONGO_DATA_DIR: path.join(mongoServiceRoot, "runtime", "data"),
    MONGOSH_DISABLE_TELEMETRY: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let mongoStdout = "";
let mongoStderr = "";
mongo.stdout?.on("data", (chunk) => {
  mongoStdout += chunk.toString();
});
mongo.stderr?.on("data", (chunk) => {
  mongoStderr += chunk.toString();
});

let bpmn;
let bpmnStdout = "";
let bpmnStderr = "";

try {
  await waitForTcp(mongoPort);
  bpmn = spawn(process.execPath, ["./src/lasso-bpmn-server.cjs"], {
    cwd: bpmnExtractRoot,
    env: {
      ...process.env,
      SERVICE_ROOT: bpmnServiceRoot,
      SERVICE_PORT: String(bpmnPort),
      SERVICE_DATA_PATH: path.join(bpmnServiceRoot, "processes"),
      MONGO_HOST: "127.0.0.1",
      MONGO_PORT: String(mongoPort),
      MONGO_USERNAME: "mongoadmin",
      MONGO_PASSWORD: "mongoadmin",
      MONGO_DB_NAME: "bpmn",
      API_KEY: "typerefinery",
      SESSION_SECRET: "typerefinery",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  bpmn.stdout?.on("data", (chunk) => {
    bpmnStdout += chunk.toString();
  });
  bpmn.stderr?.on("data", (chunk) => {
    bpmnStderr += chunk.toString();
  });

  await waitForHttp(`http://127.0.0.1:${bpmnPort}/healthcheck`);
  await waitForHttp(`http://127.0.0.1:${bpmnPort}/`);
  await waitForHttp(`http://127.0.0.1:${bpmnPort}/mocha`, 410);

  const apiResponse = await waitForHttp(`http://127.0.0.1:${bpmnPort}/api/engine/status?apiKey=typerefinery`);
  const apiBody = await apiResponse.json();
  if (!Array.isArray(apiBody)) {
    throw new Error(`Expected API engine status array, got ${JSON.stringify(apiBody)}`);
  }

  const metadata = JSON.parse(await readFile(path.join(bpmnExtractRoot, "SERVICE-LASSO-PACKAGE.json"), "utf8"));
  if (metadata.serviceId !== "bpmn-server" || metadata.version !== serviceVersion || metadata.platform !== platform) {
    throw new Error(`Unexpected package metadata: ${JSON.stringify(metadata)}`);
  }

  console.log(`[lasso-bpmn-server] verified package, Mongo dependency, health, UI, and API on port ${bpmnPort}`);
} catch (error) {
  console.error("[lasso-bpmn-server] mongo stdout:");
  console.error(mongoStdout);
  console.error("[lasso-bpmn-server] mongo stderr:");
  console.error(mongoStderr);
  console.error("[lasso-bpmn-server] bpmn stdout:");
  console.error(bpmnStdout);
  console.error("[lasso-bpmn-server] bpmn stderr:");
  console.error(bpmnStderr);
  throw error;
} finally {
  await stopChild(bpmn);
  await stopChild(mongo);
}

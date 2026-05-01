import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serviceVersion = process.env.BPMN_SERVER_VERSION ?? "1.0.0";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}: ${result.error?.message ?? ""}`);
  }
}

function runNpm(args, options = {}) {
  if (process.platform === "win32") {
    run("cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")], options);
    return;
  }

  run("npm", args, options);
}

async function zipDirectory(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = createWriteStream(target);
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize();
  });
}

async function tarDirectory(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  run("tar", ["-czf", target, "-C", source, "."]);
}

async function writeRuntimePackage(appTarget) {
  const runtimePackage = {
    name: "lasso-bpmn-server-runtime",
    version: serviceVersion,
    private: true,
    license: "ISC",
    dependencies: {
      "@fortawesome/fontawesome-free": "^6.7.2",
      "body-parser": "^1.20.3",
      "bootstrap": "^3.4.1",
      "bpmn-server": "1.3.15",
      "chart.js": "^2.9.4",
      "chalk": "^2.4.2",
      "compression": "^1.7.5",
      "connect-busboy": "^1.0.0",
      "connect-mongo": "^3.2.0",
      "dotenv": "^8.6.0",
      "errorhandler": "^1.5.1",
      "express": "^4.21.2",
      "express-flash": "^0.0.2",
      "express-session": "^1.18.1",
      "fs-extra": "^9.1.0",
      "jquery": "^3.7.1",
      "lusca": "^1.7.0",
      "mongoose": "6.5.1",
      "morgan": "^1.10.0",
      "multer": "^2.0.2",
      "popper.js": "^1.16.1",
      "pug": "^3.0.3",
      "v": "^0.3.0"
    }
  };

  await writeFile(path.join(appTarget, "package.json"), `${JSON.stringify(runtimePackage, null, 2)}\n`);
}

export async function packageBpmnServer(platform = process.platform) {
  const packageRoot = path.join(repoRoot, "output", "package", serviceVersion, platform);
  const payloadRoot = path.join(packageRoot, "payload");
  const appTarget = path.join(payloadRoot, "app");
  const distRoot = path.join(repoRoot, "dist");
  const extension = platform === "win32" ? "zip" : "tar.gz";
  const artifact = path.join(distRoot, `lasso-bpmn-server-${serviceVersion}-${platform}.${extension}`);

  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(appTarget, { recursive: true });
  await mkdir(distRoot, { recursive: true });

  await cp(path.join(repoRoot, "app"), appTarget, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
  });
  await cp(path.join(repoRoot, "src"), path.join(payloadRoot, "src"), { recursive: true });
  await writeRuntimePackage(appTarget);

  runNpm(["install", "--omit=dev", "--ignore-scripts"], { cwd: appTarget });

  const metadata = {
    serviceId: "bpmn-server",
    version: serviceVersion,
    packagedBy: "service-lasso/lasso-bpmn-server",
    platform,
    upstream: {
      donor: "TypeRefinery bpmn-server",
      npm: {
        "bpmn-server": "1.3.15"
      }
    }
  };
  await writeFile(path.join(payloadRoot, "SERVICE-LASSO-PACKAGE.json"), `${JSON.stringify(metadata, null, 2)}\n`);

  if (platform === "win32") {
    await zipDirectory(payloadRoot, artifact);
  } else {
    await tarDirectory(payloadRoot, artifact);
  }

  console.log(`[lasso-bpmn-server] packaged ${artifact}`);
  return artifact;
}

if (import.meta.url === `file://${process.argv[1].replaceAll("\\", "/")}`) {
  await packageBpmnServer(process.env.TARGET_PLATFORM ?? process.platform);
}

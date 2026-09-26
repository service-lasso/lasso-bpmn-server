import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function verifyRuntimeMiddleware(appPath) {
  const require = createRequire(path.join(path.resolve(appPath), "package.json"));
  const manifest = JSON.parse(await readFile(path.join(appPath, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(path.join(appPath, "package-lock.json"), "utf8"));
  for (const [name, version] of Object.entries({ morgan: "1.12.0", multer: "2.4.0" })) {
    assert.equal(manifest.dependencies[name], version);
    assert.equal(lock.packages[""].dependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
    assert.equal(require(`${name}/package.json`).version, version);
  }
  const express = require("express");
  const multer = require("multer");
  const morgan = require("morgan");
  const directory = await mkdtemp(path.join(os.tmpdir(), "bpmn-middleware-"));
  const app = express();
  let logged = false;
  app.use(morgan("tiny", { stream: { write() { logged = true; } } }));
  app.post("/upload", multer({ dest: directory, limits: { fileSize: 32 } }).single("file"), async (request, response, next) => {
    try {
      assert.equal(request.body.label, "compatibility");
      assert.equal(await readFile(request.file.path, "utf8"), "sample-upload");
      response.json({ accepted: true });
    } catch (error) { next(error); }
  });
  app.use((error, _request, response, _next) => {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 500).json({ accepted: false });
  });
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
    const url = `http://127.0.0.1:${server.address().port}/upload`;
    const valid = new FormData();
    valid.set("label", "compatibility");
    valid.set("file", new Blob(["sample-upload"]), "sample.txt");
    const accepted = await fetch(url, { method: "POST", body: valid });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { accepted: true });
    const oversized = new FormData();
    oversized.set("file", new Blob(["x".repeat(64)]), "oversized.txt");
    const rejected = await fetch(url, { method: "POST", body: oversized });
    assert.equal(rejected.status, 413);
    await rejected.arrayBuffer();
    assert.equal(logged, true);
    console.log("[lasso-bpmn-server] verified patched middleware versions, multipart disk upload, size rejection and logging");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("bpmn-middleware-"));
    await rm(resolved, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyRuntimeMiddleware(path.resolve(process.argv[2]));
}
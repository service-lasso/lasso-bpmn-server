#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const artifactRoot = path.resolve(__dirname, "..");
const appRoot = path.join(artifactRoot, "app");
const bundledDefinitions = path.join(appRoot, "processes");
const serviceRoot = process.env.SERVICE_ROOT ? path.resolve(process.env.SERVICE_ROOT) : artifactRoot;
const dataPath = path.resolve(
  process.env.SERVICE_DATA_PATH ||
    process.env.BPMN_DEFINITIONS_PATH ||
    path.join(serviceRoot, "processes"),
);

function copyDirectoryIfEmpty(source, target) {
  fs.mkdirSync(target, { recursive: true });
  const entries = fs.readdirSync(target);
  if (entries.length > 0) {
    return;
  }
  fs.cpSync(source, target, { recursive: true });
}

function buildMongoUrl() {
  if (process.env.MONGO_DB_URL) {
    return process.env.MONGO_DB_URL;
  }

  const host = process.env.MONGO_HOST || "127.0.0.1";
  const port = process.env.MONGO_PORT || "8180";
  const username = process.env.MONGO_USERNAME || "mongoadmin";
  const password = process.env.MONGO_PASSWORD || "mongoadmin";
  return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}?retryWrites=true&w=majority&directConnection=true`;
}

copyDirectoryIfEmpty(bundledDefinitions, dataPath);

process.env.PORT = process.env.PORT || process.env.BPMN_PORT || process.env.SERVICE_PORT || "8190";
process.env.BPMN_PORT = process.env.BPMN_PORT || process.env.PORT;
process.env.BPMN_URL = process.env.BPMN_URL || `http://127.0.0.1:${process.env.PORT}`;
process.env.API_KEY = process.env.API_KEY || "typerefinery";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "typerefinery";
process.env.MONGO_DB_NAME = process.env.MONGO_DB_NAME || "bpmn";
process.env.MONGO_DB_URL = buildMongoUrl();
process.env.DEFINITIONS_PATH = dataPath.endsWith(path.sep) ? dataPath : `${dataPath}${path.sep}`;

process.chdir(appRoot);

const app = require(path.join(appRoot, "app.js"));
const mongoose = require(path.join(appRoot, "node_modules", "mongoose"));

app.get("/healthcheck", (_request, response) => {
  const mongoReady = mongoose.connection.readyState === 1;
  response.status(mongoReady ? 200 : 503).json({
    service: "bpmn-server",
    ok: mongoReady,
    mongoReady,
    port: Number(process.env.PORT),
    definitionsPath: process.env.DEFINITIONS_PATH,
  });
});

process.on("SIGTERM", async () => {
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
});

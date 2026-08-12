# lasso-bpmn-server

Release-backed BPMN Server package for Service Lasso.

This service packages a BPMN modeling and execution server as an app-owned business-process service. It depends on the core `@node` provider and the app-owned `mongo` service.

## What It Packages

- BPMN Server app version `1.0.0`
- Web UI, Pug views, modeler assets, API routes, and sample BPMN definitions
- `src/lasso-bpmn-server.cjs`, a Service Lasso launcher that prepares environment defaults, seeds definitions into the data path, starts the app, and exposes `/healthcheck`

Release artifacts are:

- `lasso-bpmn-server-1.0.0-win32.zip`
- `lasso-bpmn-server-1.0.0-linux.tar.gz`
- `lasso-bpmn-server-1.0.0-darwin.tar.gz`
- `service.json`
- `SHA256SUMS.txt`

## Release Artifact Policy

`service.json` uses the canonical Service Lasso archive contract: `artifact.kind` is `archive`, each platform declares `assetName` and `archiveType`, and each archive is verified against `SHA256SUMS.txt` before extraction.

The manifest intentionally tracks the supported GitHub release channel `latest`, with notify-only update checks also tracking `latest`. This lets a newly published package release resolve to its own assets instead of pinning a previous release. Service Lasso records the concrete resolved release tag in its install lock, so an installed payload remains reproducible until an operator accepts an update.

## Defaults

- Service id: `bpmn-server`
- Port: `8190`
- Data path: `./processes`
- API key: `typerefinery`
- Mongo database: `bpmn`
- Mongo dependency: `mongo`
- Readiness: canonical top-level `healthchecks[]` HTTP check `http-ready`
- Health endpoint: `GET /healthcheck`

The manifest exports `BPMN_URL` and `BPMN_PORT` through `globalenv`.

## Local Verification

```powershell
npm install
npm test
```

The verifier packages the current platform, runs `npm audit --omit=dev --ignore-scripts --json` against the packaged runtime app, downloads the latest released `lasso-mongo` artifact, starts MongoDB, starts the packaged BPMN Server against that MongoDB instance, checks `/healthcheck`, checks `/`, checks `/mocha` is disabled, checks `/api/engine/status?apiKey=typerefinery`, and stops both processes.

## Dependency Hardening

The packaged runtime uses `bpmn-server` `2.3.8` and `mongoose` `6.13.11`. Formerly transitive runtime dependencies, including SendGrid mail support, are declared explicitly so the packaged service is not coupled to an older upstream dependency tree.

See [docs/dependency-audit.md](docs/dependency-audit.md).

## URL Contracts

See [docs/url-contracts.md](docs/url-contracts.md).

## Client Usage

Client-side BPMN integration is documented as API usage, not as a separate managed Service Lasso service. See [docs/client-sample.md](docs/client-sample.md).

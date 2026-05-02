# lasso-bpmn-server

Release-backed BPMN Server package for Service Lasso.

This service packages the TypeRefinery BPMN Server app as an app-owned business-process service. It depends on the core `@node` provider and the app-owned `mongo` service.

## What It Packages

- BPMN Server app version `1.0.0`
- Donor web UI, Pug views, modeler assets, API routes, and sample BPMN definitions
- `src/lasso-bpmn-server.cjs`, a Service Lasso launcher that prepares environment defaults, seeds definitions into the data path, starts the app, and exposes `/healthcheck`

Release artifacts are:

- `lasso-bpmn-server-1.0.0-win32.zip`
- `lasso-bpmn-server-1.0.0-linux.tar.gz`
- `lasso-bpmn-server-1.0.0-darwin.tar.gz`
- `service.json`
- `SHA256SUMS.txt`

## Defaults

- Service id: `bpmn-server`
- Port: `8190`
- Data path: `./processes`
- API key: `typerefinery`
- Mongo database: `bpmn`
- Mongo dependency: `mongo`
- Healthcheck: `GET /healthcheck`

The manifest exports `BPMN_URL` and `BPMN_PORT` through `globalenv`.

## Local Verification

```powershell
npm install
npm test
```

The verifier packages the current platform, downloads the latest released `lasso-mongo` artifact, starts MongoDB, starts the packaged BPMN Server against that MongoDB instance, checks `/healthcheck`, checks `/`, checks `/api/engine/status?apiKey=typerefinery`, and stops both processes.

## URL Contracts

See [docs/url-contracts.md](docs/url-contracts.md).

## Client Samples

The old BPMN client sample is documented as API/client usage, not as a separate managed service. See [docs/client-sample.md](docs/client-sample.md).

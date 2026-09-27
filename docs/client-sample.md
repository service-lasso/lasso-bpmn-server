# BPMN Client Sample Decision

## Canonical reader guidance

Start with [app-owned service tasks](https://github.com/service-lasso/service-lasso/blob/develop/docs/components/app-service-tasks.md) for BPMN client calls in your consuming application. This page retains the BPMN runtime/API examples and the docs-only client decision. Migration: [BPMN #11](https://github.com/service-lasso/lasso-bpmn-server/issues/11), [Core #1419](https://github.com/service-lasso/service-lasso/issues/1419), reviewed source `f57db8af782862baf26febc604480f4006437672`. Source examples do not establish installed-runtime acceptance or publication.

The reviewed `bpmn-client-sample` is a client script for calling a running BPMN Server API. It is not packaged as a separate Service Lasso service because it does not provide a daemon, healthcheck, UI, data directory, release-backed runtime, or standalone lifecycle contract.

Use the existing `bpmn-server` service and call its API directly from your application, script, setup step, or test harness.

## Runtime Contract

When Service Lasso starts `bpmn-server`, the manifest exports:

- `BPMN_URL`, for example `http://127.0.0.1:8190`
- `BPMN_PORT`, for example `8190`
- `API_KEY`, defaulting to `typerefinery`

All BPMN Server API routes require either the `x-api-key` header or an `apiKey` query string.

## Direct HTTP Example

```js
const bpmnUrl = process.env.BPMN_URL ?? "http://127.0.0.1:8190";
const apiKey = process.env.API_KEY ?? "typerefinery";

const start = await fetch(`${bpmnUrl}/api/engine/start/Buy%20Used%20Car`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": apiKey,
  },
  body: JSON.stringify({ data: { caseId: Date.now() } }),
});

if (!start.ok) {
  throw new Error(`BPMN start failed: ${start.status} ${await start.text()}`);
}

const instance = await start.json();
console.log(instance.id, instance.name, instance.status);
```

## `bpmn-client` Package Option

If an app prefers the upstream `bpmn-client` npm API, keep that dependency inside the app or test project that owns the workflow. Do not create a separate `lasso-bpmn-client` service repo just to host the sample.

```js
import { BPMNClient } from "bpmn-client";

const url = new URL(process.env.BPMN_URL ?? "http://127.0.0.1:8190");
const client = new BPMNClient(url.hostname, url.port, process.env.API_KEY ?? "typerefinery");

const instance = await client.engine.start("Buy Used Car", {
  caseId: Date.now(),
});

console.log(instance.id, instance.name, instance.status);
```

## Decision

Decision: docs-only.

Rationale: Service Lasso should manage the BPMN Server daemon and its MongoDB dependency. BPMN client calls are application behavior, test behavior, or one-shot job behavior owned by the consuming app. If a future app needs repeatable BPMN sample-data creation, model import, or workflow seeding, implement that as an app-owned setup/job step against `bpmn-server` rather than as a long-running service.

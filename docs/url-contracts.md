# URL Contracts

## UI

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | BPMN Server dashboard and model list |
| `GET` | `/home` | alternate dashboard route |
| `GET` | `/model/new` | create a new model |
| `GET` | `/model/edit/:process` | edit an existing model |
| `GET` | `/model/import` | import model form |
| `GET` | `/model/export` | export model form |
| `GET` | `/docs` | BPMN Server docs view |

## Health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/healthcheck` | Service Lasso health route. Returns `200` only when the Express app is running and Mongoose is connected to MongoDB. |

## API

All API routes require `x-api-key: typerefinery` or `?apiKey=typerefinery`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/engine/status` | list live engine instances |
| `POST` | `/api/engine/start/:name?` | start a process by name |
| `PUT` | `/api/engine/invoke` | invoke a waiting process item |
| `GET` | `/api/engine/get` | get an engine instance |
| `POST` | `/api/engine/throwMessage` | throw a BPMN message |
| `POST` | `/api/engine/throwSignal` | throw a BPMN signal |
| `POST` | `/api/definitions/import/:name?` | import a BPMN definition |
| `GET` | `/api/datastore/findItems` | query stored BPMN items |
| `GET` | `/api/datastore/findInstances` | query stored BPMN instances |

## Migration Notes

The old TypeRefinery service used the same app routes and default port `8190`. The Service Lasso package adds `/healthcheck` and resolves the definitions directory from `${SERVICE_DATA_PATH}` so model definitions live in runtime-managed service data instead of only inside the immutable release artifact.

Client scripts should call these API routes through `BPMN_URL` and `API_KEY`; see [client-sample.md](client-sample.md). The BPMN client sample is not a separate Service Lasso service.

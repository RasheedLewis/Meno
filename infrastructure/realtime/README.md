## Realtime WebSocket Infrastructure

This stack provisions the AWS primitives that will replace the in-process Next.js websockets:

- **API Gateway WebSocket API** (route selection on `request.body.action`)
- **Lambda handlers** for each realtime action (`$connect`, `$disconnect`, `chat.send`, `presence.update`, etc.)
- **DynamoDB connections table** (`sessionId` + `connectionId`) used to fan-out via the API Gateway Management API  
  (existing tables for chat, presence, and sessions are re-used; provide their names during deployment).

The stack is described in [`template.yaml`](./template.yaml) using the AWS SAM transform. Each Lambda is expected to live under `lambda/realtime/<handler>/` when we implement the runtime logic in the next tasks.

### Prerequisites

1. AWS CLI or SAM CLI configured with credentials that can create API Gateway, Lambda, DynamoDB, IAM, and CloudWatch resources.  
   *(Set the account/region via `aws configure --profile <profile>` or environment variables.)*
2. An S3 bucket for packaging Lambda artifacts (SAM can create one automatically).
3. Existing DynamoDB tables:
   - `meno-chat`
   - `meno-presence`
   - `meno-session` (or the names defined in `.env.example`)

### Parameters

| Parameter             | Description                                       | Default          |
| --------------------- | ------------------------------------------------- | ---------------- |
| `ServiceName`         | Prefix for resource names/tags                    | `meno-realtime`  |
| `StageName`           | API Gateway stage                                 | `prod`           |
| `ChatTableName`       | Existing chat table                               | *(required)*     |
| `PresenceTableName`   | Existing presence table                           | *(required)*     |
| `SessionTableName`    | Existing session table                            | *(required)*     |
| `ConnectionsTableName`| Connections table created by this stack           | `meno-connections` |
| `LambdaTimeout`       | Handler timeout (seconds)                         | `10`             |

### Deploy with SAM CLI (recommended)

```bash
# 1. Switch into the infrastructure directory
cd infrastructure/realtime

# 2. Validate the template locally
sam validate --template-file template.yaml

# 3. Build (bundles Node.js handlers once they exist)
sam build --use-container

# 4. Deploy (creates/updates the CloudFormation stack)
sam deploy \
  --stack-name meno-realtime-websocket \
  --capabilities CAPABILITY_NAMED_IAM \
  --region <aws-region> \
  --parameter-overrides \
      ServiceName=meno-realtime \
      StageName=prod \
      ChatTableName=meno-chat \
      PresenceTableName=meno-presence \
      SessionTableName=meno-session
```

SAM will prompt for an artefact bucket the first time. If you prefer to control it explicitly, add `--s3-bucket <bucket-name>`.

### Manual deployment with AWS CLI

If you are not using the SAM CLI:

```bash
# Package the template (uploads Lambda code to S3)
aws cloudformation package \
  --template-file infrastructure/realtime/template.yaml \
  --s3-bucket <artifact-bucket> \
  --output-template-file /tmp/meno-realtime-packaged.yaml

# Deploy the packaged template
aws cloudformation deploy \
  --template-file /tmp/meno-realtime-packaged.yaml \
  --stack-name meno-realtime-websocket \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      ServiceName=meno-realtime \
      StageName=prod \
      ChatTableName=meno-chat \
      PresenceTableName=meno-presence \
      SessionTableName=meno-session
```

### Post-deploy checklist on AWS

1. **Confirm API Gateway WebSocket endpoint:**  
   `wss://<api-id>.execute-api.<region>.amazonaws.com/<StageName>` (output `WebSocketInvokeUrl`).
2. **Verify DynamoDB connections table** (`ConnectionsTableName`) exists with TTL enabled.
3. **Allow Lambdas to write to existing tables** — policies are attached automatically via the template; double-check if custom table names are used.
4. **Set environment variables locally**:
   - Web: `NEXT_PUBLIC_REALTIME_WEBSOCKET_URL=wss://<api-id>.execute-api.<region>.amazonaws.com/<stage>`
   - Server (optional override): `REALTIME_WEBSOCKET_URL=...`
   - Companion app `app.json`: `extra.realtimeWsUrl`
5. **(Optional)** Create a dedicated IAM user/role for CI/CD deployments of this stack.

Once the infrastructure is live, we can implement the Lambda runtime logic and update the clients to talk to this endpoint.


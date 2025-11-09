# WebSocket Broadcast Debugging Guide

## Overview

This document explains the WebSocket broadcast flow and how to debug issues with messages not reaching other clients.

## System Architecture

### Flow Overview

1. **Client A** sends a chat message via WebSocket
2. **API Gateway** routes the message to the `chat-send` Lambda based on `action: "chat.send"`
3. **chat-send Lambda**:
   - Retrieves the connection metadata from DynamoDB
   - Persists the message to the chat table
   - Queries all connections for the session using the GSI
   - Broadcasts to all connections via API Gateway Management API
4. **API Gateway** delivers the message to **Client A** and **Client B**
5. **Clients** receive the broadcast and update their UI

## Common Issues

### 1. Global Secondary Index (GSI) Not Active

**Symptom**: Logs show "Query returned 0 items" even when connections exist

**Check**:
```bash
aws dynamodb describe-table --table-name meno-connections --region YOUR_REGION
```

Look for `IndexStatus: "ACTIVE"` on the `sessionId-index` GSI.

**Fix**: Wait for the GSI to become active (can take several minutes after deployment)

### 2. Connections Not Being Stored with Correct SessionId

**Symptom**: Logs show different sessionIds in connect vs chat-send

**Check CloudWatch Logs for**:
- `[connect] New connection: connectionId=..., sessionId=...`
- `[chat.send] Broadcasting message ... to session ...`

**Fix**: Ensure the client is passing the correct sessionId in the WebSocket URL query parameters

### 3. API Gateway Management API Endpoint Issue

**Symptom**: Errors like "Unable to call connection" or "Invalid endpoint"

**Check**: The endpoint format should be `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`

**Logs to check**:
```
[broadcast] Broadcasting to N connections
```

If you see errors after this, the endpoint is likely incorrect.

### 4. Lambda Permissions

**Symptom**: "Access Denied" errors in CloudWatch

**Fix**: Ensure the Lambda has these policies:
- `execute-api:ManageConnections` - to post to connections
- Query access to the connections table and GSI

### 5. Client Not Listening for Messages

**Symptom**: Server logs show successful broadcast, but client doesn't update

**Check Browser Console for**:
- `[Realtime] WebSocket connected for room: ...`
- `[Realtime] Received message type: chat.message`
- `[chatClient] Received chat.message: ...`

**Fix**: Ensure the client has registered listeners before sending messages

## Debugging Steps

### Step 1: Check Lambda Logs (CloudWatch)

After sending a message from Client A, check CloudWatch logs for the `chat-send` Lambda:

```
[connect] New connection: connectionId=ABC, sessionId=sess-123, participantId=p1
[connect] New connection: connectionId=XYZ, sessionId=sess-123, participantId=p2

[chat.send] Broadcasting message msg-456 to session sess-123
[connections] Querying connections for sessionId: sess-123
[connections] Query returned 2 items
[broadcast] Found 2 connections for session sess-123
[broadcast] Broadcasting to 2 connections (excluding none)
```

**Expected**: You should see 2+ connections returned for the session

**If you see 0 connections**:
- The GSI might not be active yet
- The sessionId doesn't match what was stored during connect
- The connections expired due to TTL

### Step 2: Check Client Console (Browser DevTools)

After Client A sends a message:

**Client A should see**:
```
[Realtime] Sending action: chat.send { sessionId: "sess-123", message: {...} }
[Realtime] Received message type: chat.message
[chatClient] Received chat.message: { sessionId: "sess-123", message: {...} }
[chatClient] Adding message to store: {...}
```

**Client B should see**:
```
[Realtime] Received message type: chat.message
[chatClient] Received chat.message: { sessionId: "sess-123", message: {...} }
[chatClient] Adding message to store: {...}
```

**If Client B doesn't see the message**:
- Check if the WebSocket is connected: `[Realtime] WebSocket connected for room: ...`
- Check if listeners are registered: should NOT see "No listeners registered for type: chat.message"
- Check the sessionId matches

### Step 3: Verify DynamoDB Connections

Query the connections table directly:

```bash
aws dynamodb query \
  --table-name meno-connections \
  --index-name sessionId-index \
  --key-condition-expression "sessionId = :sid" \
  --expression-attribute-values '{":sid":{"S":"YOUR_SESSION_ID"}}' \
  --region YOUR_REGION
```

**Expected**: Should return all active connections for the session

### Step 4: Test API Gateway Management API

The Lambda uses the API Gateway Management API to post to connections. Verify it's working:

1. Get a connectionId from the DynamoDB table
2. Try posting a test message:

```bash
aws apigatewaymanagementapi post-to-connection \
  --connection-id YOUR_CONNECTION_ID \
  --data '{"type":"system.pong","data":{"timestamp":123}}' \
  --endpoint-url https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/YOUR_STAGE
```

**Expected**: The client should receive the message

**If it fails**: The endpoint URL is incorrect or the connection is stale

## Quick Fixes

### Issue: Messages not broadcasting at all

1. **Redeploy the stack** to ensure GSI is active:
   ```bash
   cd infrastructure/realtime
   sam build
   sam deploy
   ```

2. **Wait 2-5 minutes** for the GSI to become active

3. **Refresh both clients** to establish new connections

### Issue: Client receives own messages but not from others

1. **Check sessionId** - both clients must use the SAME sessionId
2. **Check browser console** for WebSocket connection status
3. **Verify in DynamoDB** that both connections exist with the same sessionId

### Issue: Intermittent failures

1. **Check TTL** - connections expire after 6 hours
2. **Check for stale connections** - disconnect handler should clean up
3. **Enable detailed CloudWatch metrics** on API Gateway

## Current Logging

### Server-Side (Lambda)

All Lambdas now have detailed logging:
- `connect` - Logs when connections are established
- `chat-send` - Logs message broadcasts
- `disconnect` - Logs connection cleanup
- `connections.js` - Logs DynamoDB operations
- `broadcast.js` - Logs WebSocket delivery

### Client-Side (Browser)

- `channel.ts` - Logs WebSocket connection and messages
- `client.ts` - Logs message handling

## Next Steps

1. **Deploy the updated Lambda code** with the new logging
2. **Open two browser windows** with the same sessionId
3. **Open DevTools console** in both windows
4. **Send a message** from one window
5. **Review logs** in both the console and CloudWatch

The logs will reveal exactly where the message flow breaks down.

## Expected Log Flow

### Server-Side (CloudWatch)
```
[connect] New connection: connectionId=ABC, sessionId=sess-123, participantId=p1
[connections] Storing connection: {"connectionId":"ABC","sessionId":"sess-123","participantId":"p1"}
[connections] Connection stored successfully

[connect] New connection: connectionId=XYZ, sessionId=sess-123, participantId=p2
[connections] Storing connection: {"connectionId":"XYZ","sessionId":"sess-123","participantId":"p2"}
[connections] Connection stored successfully

[chat.send] Broadcasting message msg-456 to session sess-123
[connections] Querying connections for sessionId: sess-123, table: meno-connections, index: sessionId-index
[connections] Query returned 2 items
[broadcast] Found 2 connections for session sess-123
[broadcast] Broadcasting to 2 connections (excluding ABC)
```

### Client-Side (Browser Console)

**Client A (sender):**
```
[Realtime] WebSocket connected for room: sess-123
[Realtime] Sending action: chat.send {...}
[Realtime] Received message type: chat.message
[chatClient] Received chat.message: {...}
[chatClient] Adding message to store: {...}
```

**Client B (receiver):**
```
[Realtime] WebSocket connected for room: sess-123
[Realtime] Received message type: chat.message
[chatClient] Received chat.message: {...}
[chatClient] Adding message to store: {...}
```


# Deployment Steps to Fix WebSocket Broadcast

## Summary

The WebSocket infrastructure is deployed and the GSI is ACTIVE, but **no connections are being stored** in DynamoDB (ItemCount: 0). This means clients aren't connecting successfully, likely due to missing environment configuration.

## Current Status

✅ **WebSocket API**: `wss://6s6vph1fq9.execute-api.us-east-2.amazonaws.com/prod`  
✅ **DynamoDB Table**: `meno-connections` (ACTIVE)  
✅ **GSI**: `sessionId-index` (ACTIVE)  
❌ **Connections**: 0 stored (clients not connecting)  
❌ **Lambda Logging**: Not deployed yet

## Step 1: Deploy Updated Lambda Functions

The Lambda functions now have comprehensive logging to help debug. Deploy them:

```bash
cd infrastructure/realtime
sam build
sam deploy --guided
```

When prompted:
- Stack Name: `meno-realtime-websocket`
- AWS Region: `us-east-2`
- Parameter ServiceName: `meno-realtime`
- Parameter StageName: `prod`
- Parameter ChatTableName: `meno-chat`
- Parameter PresenceTableName: `meno-presence`
- Parameter SessionTableName: `meno-session`
- Parameter ConnectionsTableName: `meno-connections`
- Parameter LambdaTimeout: `10`
- Confirm changes before deploy: `N` (or `Y` to review first)
- Allow SAM CLI IAM role creation: `Y`
- Disable rollback: `Y`
- Save arguments to configuration file: `Y`

## Step 2: Configure Environment Variables

The web app needs the WebSocket URL. Create or update `meno-web/.env.local`:

```bash
cd meno-web
cat > .env.local << 'EOF'
NEXT_PUBLIC_REALTIME_WEBSOCKET_URL="wss://6s6vph1fq9.execute-api.us-east-2.amazonaws.com/prod"
EOF
```

## Step 3: Restart the Development Server

```bash
# Kill existing Next.js process
pkill -f "next dev"

# Start fresh
npm run dev
```

## Step 4: Test the Connection

1. **Open browser DevTools console** (F12)
2. **Navigate to your app** (e.g., `http://localhost:3000`)
3. **Look for WebSocket logs**:
   ```
   [Realtime] WebSocket connected for room: <sessionId>
   ```

If you see:
- `[Realtime] REALTIME_WEBSOCKET_URL/NEXT_PUBLIC_REALTIME_WEBSOCKET_URL is not configured`
  → The env variable isn't loaded (restart the dev server)

- No WebSocket logs at all
  → The client isn't trying to connect (check if the session is initialized)

## Step 5: Verify Connection in DynamoDB

After connecting, check if the connection is stored:

```bash
aws dynamodb scan --table-name meno-connections --region us-east-2 --max-items 5
```

You should see your connection with:
- `connectionId`
- `sessionId`
- `participantId`
- `name`

If still 0 items, check CloudWatch logs:

```bash
aws logs tail /aws/lambda/meno-realtime-connect --region us-east-2 --follow
```

## Step 6: Test Broadcast Between Two Clients

1. **Open two browser tabs** side by side
2. **Use the SAME sessionId** in both tabs
3. **Open DevTools console** in BOTH tabs
4. **Send a message** from Tab 1
5. **Check Tab 2 console** for:
   ```
   [Realtime] Received message type: chat.message
   [chatClient] Received chat.message: {...}
   [chatClient] Adding message to store: {...}
   ```

## Expected Log Flow

### Browser Console (Tab 1 - Sender)
```
[Realtime] WebSocket connected for room: sess-123
[Realtime] Sending action: chat.send {...}
[Realtime] Received message type: chat.message
[chatClient] Received chat.message: {...}
[chatClient] Adding message to store: {...}
```

### Browser Console (Tab 2 - Receiver)
```
[Realtime] WebSocket connected for room: sess-123
[Realtime] Received message type: chat.message
[chatClient] Received chat.message: {...}
[chatClient] Adding message to store: {...}
```

### CloudWatch Logs (Lambda)
```
[connect] New connection: connectionId=ABC, sessionId=sess-123, participantId=p1
[connections] Storing connection: {"connectionId":"ABC","sessionId":"sess-123"}
[connections] Connection stored successfully

[chat.send] Broadcasting message msg-456 to session sess-123
[connections] Querying connections for sessionId: sess-123
[connections] Query returned 2 items
[broadcast] Found 2 connections for session sess-123
[broadcast] Broadcasting to 2 connections (excluding ABC)
```

## Troubleshooting

### Issue: "No connections found for session"

Check:
1. Both clients are using the **exact same sessionId**
2. Connections are actually stored in DynamoDB
3. The GSI is ACTIVE (already confirmed ✅)

### Issue: "WebSocket connection failed"

Check:
1. The WebSocket URL is correct in `.env.local`
2. API Gateway is deployed and accessible
3. CORS/security policies if using HTTPS

### Issue: "Messages not appearing in other clients"

Check:
1. Both clients are connected (check DynamoDB connections table)
2. Both clients have the same sessionId
3. Check CloudWatch logs for broadcast errors
4. Check browser console for listener registration

## Quick Verification Commands

```bash
# Check DynamoDB connections
aws dynamodb describe-table --table-name meno-connections --region us-east-2 | grep -A 2 "ItemCount"

# Check recent connect attempts
aws logs tail /aws/lambda/meno-realtime-connect --region us-east-2 --since 5m --format short

# Check recent chat broadcasts
aws logs tail /aws/lambda/meno-realtime-chat-send --region us-east-2 --since 5m --format short

# Scan actual connections
aws dynamodb scan --table-name meno-connections --region us-east-2
```

## Next Steps

After completing these steps, you should see:
- Connections being stored in DynamoDB
- Detailed logs in CloudWatch showing the broadcast flow
- Messages appearing in multiple client windows

If issues persist, the comprehensive logging will show exactly where the flow breaks down.


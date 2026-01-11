# Redis Quick Reference

## 🎯 Quick Start

Redis is configured and running locally at `redis://localhost:6379`

```bash
# Test Redis connection
npm run redis:test

# Check Redis status
./scripts/redis-helper.sh status

# Monitor real-time activity
npm run redis:monitor
```

## 📋 Common Tasks

### Development

- **Start Dev Server**: `npm run dev` (Redis auto-connects)
- **Test Connection**: `npm run redis:test`
- **Monitor Activity**: `npm run redis:monitor`

### Service Management

- **Start**: `brew services start redis` ✅ (already running)
- **Stop**: `brew services stop redis`
- **Restart**: `brew services restart redis`
- **Status**: `brew services info redis`

### Debugging

```bash
# Interactive CLI
npm run redis:cli

# Watch pub/sub messages
./scripts/redis-helper.sh subscribe subscription-events

# View all keys
./scripts/redis-helper.sh keys

# Show connected clients
./scripts/redis-helper.sh clients
```

## 🔧 Helper Script

The `redis-helper.sh` script provides convenient commands:

```bash
./scripts/redis-helper.sh status      # Show full status
./scripts/redis-helper.sh monitor     # Monitor commands
./scripts/redis-helper.sh subscribe   # Watch pub/sub
./scripts/redis-helper.sh keys        # List all keys
./scripts/redis-helper.sh help        # Show all commands
```

## 📚 Documentation

Full documentation: [redis-local-setup.md](../redis-local-setup.md)

## ⚡ Key Features

- ✅ Auto-reconnect enabled
- ✅ Pub/Sub for real-time events
- ✅ Health monitoring
- ✅ TLS support for production (Upstash)
- ✅ In-memory fallback when Redis unavailable

## 🚀 Production

For production (Vercel), use Upstash:

1. Sign up at https://upstash.com
2. Create Redis database
3. Add `REDIS_URL=rediss://...` to Vercel environment variables

---

**Current Status**: ✅ Running and configured

# Redis Local Setup Guide

## Overview

Redis is configured and running locally for the AuraSwift application. This guide covers management, monitoring, and troubleshooting.

## ✅ Installation Complete

Redis has been installed via Homebrew and is running as a background service.

**Version**: Redis 8.4.0  
**Connection**: `redis://localhost:6379`

## 🎯 Quick Commands

### Service Management

```bash
# Start Redis (already running as service)
brew services start redis

# Stop Redis
brew services stop redis

# Restart Redis
brew services restart redis

# Check Redis service status
brew services info redis
```

### Testing Connection

```bash
# Simple ping test
redis-cli ping
# Expected output: PONG

# Interactive Redis CLI
redis-cli

# Monitor all Redis commands in real-time
redis-cli monitor

# Get Redis server info
redis-cli info
```

### Application Testing

```bash
# Navigate to web directory
cd /Users/admin/Documents/Developer/FullStackDev/AuraSwift/web

# Run the Redis connection test
npm run redis:test

# Or directly with tsx
tsx -r dotenv/config scripts/redis-test.ts dotenv_config_path=.env.local
```

## 🔧 Configuration

### Environment Variables

The `.env.local` file has been updated with:

```env
REDIS_URL=redis://localhost:6379
```

### Redis Config File Location

```bash
/opt/homebrew/etc/redis.conf
```

### Default Settings

- **Port**: 6379
- **Host**: localhost (127.0.0.1)
- **Password**: None (local development)
- **Database**: 0 (default)
- **Persistence**: RDB snapshots enabled
- **Max Memory**: System dependent

## 📊 Monitoring & Debugging

### View Real-time Statistics

```bash
redis-cli info stats
```

### Monitor Active Connections

```bash
redis-cli client list
```

### Check Memory Usage

```bash
redis-cli info memory
```

### View All Keys (Development Only)

```bash
redis-cli keys "*"
```

### Subscribe to Pub/Sub Channels

```bash
# Monitor all pub/sub activity
redis-cli psubscribe "*"

# Subscribe to specific channel
redis-cli subscribe subscription-events
```

## 🚀 NPM Scripts

Add these to `web/package.json`:

```json
{
  "scripts": {
    "redis:test": "tsx -r dotenv/config scripts/redis-test.ts dotenv_config_path=.env.local",
    "redis:monitor": "redis-cli monitor",
    "redis:info": "redis-cli info",
    "redis:cli": "redis-cli"
  }
}
```

## 🔍 Troubleshooting

### Redis Not Running

```bash
# Check if Redis is running
brew services list | grep redis

# If not running, start it
brew services start redis
```

### Connection Issues

```bash
# Test basic connectivity
redis-cli ping

# Check if port 6379 is in use
lsof -i :6379

# View Redis logs
tail -f /opt/homebrew/var/log/redis.log
```

### Clear All Data (Development Only)

```bash
# WARNING: This will delete all Redis data
redis-cli flushall
```

### Memory Issues

```bash
# Check memory usage
redis-cli info memory

# Set max memory limit (example: 256MB)
redis-cli config set maxmemory 256mb

# Set eviction policy
redis-cli config set maxmemory-policy allkeys-lru
```

## 🏗️ Architecture

### How AuraSwift Uses Redis

1. **Pub/Sub for Real-time Events**

   - Subscription updates are published to Redis channels
   - Multiple server instances subscribe to these channels
   - Enables real-time SSE (Server-Sent Events) across instances

2. **Event Broadcasting**

   - Desktop app subscription syncs
   - Payment method updates
   - License key activations

3. **Channels Used**
   - `subscription-events`: Main subscription update channel
   - Custom channels per feature as needed

### Connection Pattern

- **Publisher**: Singleton instance shared across the app
- **Subscriber**: One per SSE connection (created on-demand)
- **Auto-reconnect**: Built-in retry logic with exponential backoff

## 📝 Development Workflow

### Starting Development

```bash
# 1. Ensure Redis is running
brew services start redis

# 2. Verify connection
redis-cli ping

# 3. Start your Next.js app
cd web && npm run dev
```

### Testing Pub/Sub

```bash
# Terminal 1: Subscribe to events
redis-cli subscribe subscription-events

# Terminal 2: Publish test event
redis-cli publish subscription-events '{"type":"test","data":{}}'

# Terminal 1 should show the message
```

## 🌐 Production Considerations

For production deployment (Vercel), you'll need to:

1. **Use Upstash Redis** (recommended for serverless)

   - Sign up at https://upstash.com
   - Create a Redis database
   - Get the `rediss://` connection URL
   - Add to Vercel environment variables

2. **Update Environment Variable**

   ```env
   REDIS_URL=rediss://default:your_password@your-host.upstash.io:6379
   ```

3. **TLS Support**
   - Already configured in code for `rediss://` URLs
   - No additional changes needed

## 🛠️ Advanced Configuration

### Optimize for Development

Edit `/opt/homebrew/etc/redis.conf`:

```conf
# Reduce disk writes for faster development
save ""

# Increase max clients (default is 10000)
maxclients 20000

# Set memory limit
maxmemory 512mb
maxmemory-policy allkeys-lru

# Enable AOF for better durability (optional)
appendonly no
```

After editing, restart Redis:

```bash
brew services restart redis
```

### Performance Tuning

```bash
# Disable background saves (faster, but data loss on crash)
redis-cli config set save ""

# Enable lazy freeing for better performance
redis-cli config set lazyfree-lazy-eviction yes
redis-cli config set lazyfree-lazy-expire yes
```

## 📚 Useful Resources

- **Redis Documentation**: https://redis.io/documentation
- **ioredis (Node.js client)**: https://github.com/redis/ioredis
- **Redis Commands**: https://redis.io/commands
- **Redis Pub/Sub**: https://redis.io/topics/pubsub
- **Upstash**: https://upstash.com (for production)

## 🎯 Next Steps

1. ✅ Redis installed and running
2. ✅ Environment variables configured
3. ✅ Test script created
4. 🔄 Run `npm run redis:test` to verify setup
5. 🚀 Start developing with real-time features!

---

**Status**: Redis is ready for local development! 🎉

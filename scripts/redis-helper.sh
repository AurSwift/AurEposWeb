#!/bin/bash

# Redis Development Helper Script
# Quick commands for managing Redis in development

set -e

REDIS_URL="redis://localhost:6379"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
}

check_redis() {
    if ! command -v redis-cli &> /dev/null; then
        echo -e "${RED}❌ Redis CLI not found. Install with: brew install redis${NC}"
        exit 1
    fi

    if ! redis-cli ping &> /dev/null; then
        echo -e "${RED}❌ Redis is not running. Start with: brew services start redis${NC}"
        exit 1
    fi
}

show_status() {
    print_header "Redis Status"
    
    echo -e "${GREEN}✓ Redis is running${NC}"
    echo
    
    echo "Service Status:"
    brew services info redis | grep "Running" || echo "  Status: Unknown"
    echo
    
    echo "Connection:"
    echo "  URL: $REDIS_URL"
    redis-cli -h localhost -p 6379 ping > /dev/null && echo -e "  ${GREEN}✓ Connected${NC}" || echo -e "  ${RED}✗ Connection failed${NC}"
    echo
    
    echo "Version:"
    redis-cli info server | grep redis_version | sed 's/redis_version:/  /'
    echo
    
    echo "Memory Usage:"
    redis-cli info memory | grep used_memory_human | sed 's/used_memory_human:/  Total: /'
    redis-cli info memory | grep used_memory_rss_human | sed 's/used_memory_rss_human:/  RSS: /'
    echo
    
    echo "Stats:"
    redis-cli info stats | grep total_connections_received | sed 's/total_connections_received:/  Connections: /'
    redis-cli info stats | grep total_commands_processed | sed 's/total_commands_processed:/  Commands: /'
    redis-cli dbsize | sed 's/^/  Keys: /'
    echo
}

show_clients() {
    print_header "Connected Clients"
    redis-cli client list
    echo
}

show_keys() {
    print_header "Redis Keys"
    
    key_count=$(redis-cli dbsize | grep -o '[0-9]*')
    
    if [ "$key_count" -eq 0 ]; then
        echo "No keys found in database"
    else
        echo "Total keys: $key_count"
        echo
        echo "Keys by pattern:"
        redis-cli --scan --pattern "*" | head -20
        
        if [ "$key_count" -gt 20 ]; then
            echo "..."
            echo "(showing first 20 of $key_count keys)"
        fi
    fi
    echo
}

monitor_activity() {
    print_header "Monitoring Redis Activity (Ctrl+C to stop)"
    echo "Watching all commands in real-time..."
    echo
    redis-cli monitor
}

subscribe_channel() {
    local channel="${1:-subscription-events}"
    print_header "Subscribing to: $channel (Ctrl+C to stop)"
    echo "Waiting for messages..."
    echo
    redis-cli subscribe "$channel"
}

flush_all() {
    print_header "⚠️  WARNING: Flush All Data"
    echo -e "${RED}This will delete ALL data from Redis!${NC}"
    echo -e "${YELLOW}This action cannot be undone.${NC}"
    echo
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        redis-cli flushall
        echo -e "${GREEN}✓ All data flushed${NC}"
    else
        echo "Aborted"
    fi
    echo
}

show_info() {
    local section="${1:-all}"
    print_header "Redis Info: $section"
    redis-cli info "$section"
    echo
}

benchmark() {
    print_header "Running Redis Benchmark"
    echo "Testing performance with 10000 requests..."
    echo
    redis-cli --csv --latency | head -5
    echo
    echo "Quick benchmark (10k requests):"
    redis-cli -q -l --csv --latency-history 1 5
}

show_help() {
    cat << EOF
${BLUE}Redis Development Helper${NC}

Usage: ./redis-helper.sh [command]

Commands:
  ${GREEN}status${NC}              Show Redis status and statistics
  ${GREEN}clients${NC}             Show connected clients
  ${GREEN}keys${NC}                List all keys in database
  ${GREEN}monitor${NC}             Monitor all Redis commands in real-time
  ${GREEN}subscribe [channel]${NC} Subscribe to a pub/sub channel (default: subscription-events)
  ${GREEN}flush${NC}               Flush all data (with confirmation)
  ${GREEN}info [section]${NC}      Show Redis info (server, stats, memory, etc.)
  ${GREEN}benchmark${NC}           Run performance benchmark
  ${GREEN}help${NC}                Show this help message

Quick Redis CLI Commands:
  ${YELLOW}redis-cli${NC}                    Start interactive Redis CLI
  ${YELLOW}redis-cli ping${NC}               Test connection
  ${YELLOW}redis-cli dbsize${NC}             Get number of keys
  ${YELLOW}redis-cli keys "*"${NC}           List all keys (use carefully)
  ${YELLOW}redis-cli get <key>${NC}          Get value of key
  ${YELLOW}redis-cli set <key> <val>${NC}    Set key-value
  ${YELLOW}redis-cli del <key>${NC}          Delete key

NPM Scripts:
  ${YELLOW}npm run redis:test${NC}           Run Redis connection test
  ${YELLOW}npm run redis:monitor${NC}        Monitor Redis activity
  ${YELLOW}npm run redis:info${NC}           Show Redis info
  ${YELLOW}npm run redis:cli${NC}            Start Redis CLI

Service Management (Homebrew):
  ${YELLOW}brew services start redis${NC}    Start Redis service
  ${YELLOW}brew services stop redis${NC}     Stop Redis service
  ${YELLOW}brew services restart redis${NC}  Restart Redis service

Examples:
  ./redis-helper.sh status
  ./redis-helper.sh subscribe subscription-events
  ./redis-helper.sh info memory

EOF
}

# Main script logic
check_redis

case "${1:-help}" in
    status)
        show_status
        ;;
    clients)
        show_clients
        ;;
    keys)
        show_keys
        ;;
    monitor)
        monitor_activity
        ;;
    subscribe)
        subscribe_channel "$2"
        ;;
    flush)
        flush_all
        ;;
    info)
        show_info "${2:-all}"
        ;;
    benchmark)
        benchmark
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo
        show_help
        exit 1
        ;;
esac

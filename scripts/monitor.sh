#!/bin/bash

# PredictionPump Monitoring Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROMETHEUS_URL="http://localhost:9090"
GRAFANA_URL="http://localhost:3001"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

# Check system status
check_system_status() {
    echo -e "${BLUE}🔍 Checking system status...${NC}"
    
    # Check services
    services=("frontend" "backend" "postgres" "redis" "prometheus" "grafana")
    
    for service in "${services[@]}"; do
        if docker-compose -f docker-compose.prod.yml ps $service | grep -q "Up"; then
            echo -e "${GREEN}✅ $service is running${NC}"
        else
            echo -e "${RED}❌ $service is not running${NC}"
        fi
    done
}

# Check application metrics
check_metrics() {
    echo -e "${BLUE}📊 Checking application metrics...${NC}"
    
    # Check if Prometheus is accessible
    if curl -s "$PROMETHEUS_URL/api/v1/query?query=up" > /dev/null; then
        echo -e "${GREEN}✅ Prometheus is accessible${NC}"
        
        # Get application health
        response=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=up")
        echo "Application health status:"
        echo $response | jq -r '.data.result[] | "\(.metric.instance): \(.value[1])"'
        
        # Get error rate
        error_response=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])")
        echo -e "\n${YELLOW}Error rates:${NC}"
        echo $error_response | jq -r '.data.result[] | "\(.metric.instance): \(.value[1])"'
        
        # Get response time
        response_time=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))")
        echo -e "\n${YELLOW}95th percentile response times:${NC}"
        echo $response_time | jq -r '.data.result[] | "\(.metric.instance): \(.value[1])s"'
        
    else
        echo -e "${RED}❌ Prometheus is not accessible${NC}"
    fi
}

# Check resource usage
check_resources() {
    echo -e "${BLUE}💻 Checking resource usage...${NC}"
    
    # Memory usage
    memory_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}")
    echo -e "${YELLOW}Memory usage:${NC}"
    echo "$memory_usage"
    
    # CPU usage
    echo -e "\n${YELLOW}CPU usage:${NC}"
    cpu_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}")
    echo "$cpu_usage"
    
    # Disk usage
    echo -e "\n${YELLOW}Disk usage:${NC}"
    df -h
}

# Check logs for errors
check_logs() {
    echo -e "${BLUE}📝 Checking recent logs for errors...${NC}"
    
    # Check backend logs
    echo -e "${YELLOW}Backend errors (last 10):${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=100 backend | grep -i error | tail -10 || echo "No recent errors found"
    
    # Check frontend logs
    echo -e "\n${YELLOW}Frontend errors (last 10):${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=100 frontend | grep -i error | tail -10 || echo "No recent errors found"
    
    # Check database logs
    echo -e "\n${YELLOW}Database errors (last 10):${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=100 postgres | grep -i error | tail -10 || echo "No recent errors found"
}

# Check database health
check_database() {
    echo -e "${BLUE}🗄️ Checking database health...${NC}"
    
    # Connection count
    conn_count=$(docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d predictionpump -c "SELECT count(*) FROM pg_stat_activity;" | grep -E '^\s*[0-9]+' | xargs)
    echo -e "${YELLOW}Active connections: $conn_count${NC}"
    
    # Database size
    db_size=$(docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d predictionpump -c "SELECT pg_size_pretty(pg_database_size('predictionpump'));" | grep -E '^\s*[0-9]' | xargs)
    echo -e "${YELLOW}Database size: $db_size${NC}"
    
    # Long running queries
    echo -e "${YELLOW}Long running queries (>30s):${NC}"
    docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d predictionpump -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '30 seconds';" || echo "No long running queries"
}

# Check WebSocket connections
check_websockets() {
    echo -e "${BLUE}🔌 Checking WebSocket connections...${NC}"
    
    # This would need to be implemented in the backend to expose metrics
    echo -e "${YELLOW}WebSocket metrics would be available through Prometheus${NC}"
}

# Generate report
generate_report() {
    echo -e "${BLUE}📋 Generating monitoring report...${NC}"
    
    report_file="/tmp/predictionpump_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "PredictionPump Monitoring Report"
        echo "Generated: $(date)"
        echo "================================"
        echo ""
        
        echo "SYSTEM STATUS:"
        check_system_status 2>&1
        echo ""
        
        echo "RESOURCE USAGE:"
        check_resources 2>&1
        echo ""
        
        echo "DATABASE HEALTH:"
        check_database 2>&1
        echo ""
        
        echo "RECENT ERRORS:"
        check_logs 2>&1
        
    } > $report_file
    
    echo -e "${GREEN}✅ Report generated: $report_file${NC}"
    
    # Send alert if webhook is configured
    if [ ! -z "$ALERT_WEBHOOK_URL" ]; then
        curl -X POST -H "Content-Type: application/json" \
             -d "{\"text\":\"PredictionPump monitoring report generated: $report_file\"}" \
             "$ALERT_WEBHOOK_URL"
    fi
}

# Alert on critical issues
check_alerts() {
    echo -e "${BLUE}🚨 Checking for critical alerts...${NC}"
    
    critical_issues=0
    
    # Check if any service is down
    services=("frontend" "backend" "postgres" "redis")
    for service in "${services[@]}"; do
        if ! docker-compose -f docker-compose.prod.yml ps $service | grep -q "Up"; then
            echo -e "${RED}🚨 CRITICAL: $service is down${NC}"
            critical_issues=$((critical_issues + 1))
        fi
    done
    
    # Check memory usage
    memory_usage=$(docker stats --no-stream --format "{{.MemPerc}}" | sed 's/%//' | sort -nr | head -1)
    if (( $(echo "$memory_usage > 90" | bc -l) )); then
        echo -e "${RED}🚨 CRITICAL: High memory usage: ${memory_usage}%${NC}"
        critical_issues=$((critical_issues + 1))
    fi
    
    # Check disk usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        echo -e "${RED}🚨 CRITICAL: High disk usage: ${disk_usage}%${NC}"
        critical_issues=$((critical_issues + 1))
    fi
    
    if [ $critical_issues -eq 0 ]; then
        echo -e "${GREEN}✅ No critical issues detected${NC}"
    else
        echo -e "${RED}🚨 $critical_issues critical issues detected${NC}"
        
        # Send alert if webhook is configured
        if [ ! -z "$ALERT_WEBHOOK_URL" ]; then
            curl -X POST -H "Content-Type: application/json" \
                 -d "{\"text\":\"🚨 PredictionPump ALERT: $critical_issues critical issues detected\"}" \
                 "$ALERT_WEBHOOK_URL"
        fi
    fi
}

# Main function
main() {
    case "${1:-status}" in
        "status")
            check_system_status
            ;;
        "metrics")
            check_metrics
            ;;
        "resources")
            check_resources
            ;;
        "logs")
            check_logs
            ;;
        "database")
            check_database
            ;;
        "websockets")
            check_websockets
            ;;
        "report")
            generate_report
            ;;
        "alerts")
            check_alerts
            ;;
        "full")
            check_system_status
            echo ""
            check_metrics
            echo ""
            check_resources
            echo ""
            check_database
            echo ""
            check_logs
            echo ""
            check_alerts
            ;;
        *)
            echo "Usage: $0 [status|metrics|resources|logs|database|websockets|report|alerts|full]"
            exit 1
            ;;
    esac
}

main "$@"
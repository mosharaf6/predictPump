#!/bin/bash

# PredictionPump Production Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"

echo -e "${GREEN}🚀 Starting PredictionPump deployment for ${ENVIRONMENT}${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        echo -e "${RED}❌ Environment file .env.${ENVIRONMENT} not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Create backup
create_backup() {
    echo -e "${YELLOW}💾 Creating backup...${NC}"
    
    mkdir -p $BACKUP_DIR
    
    # Backup database
    docker-compose exec -T postgres pg_dump -U postgres predictionpump > $BACKUP_DIR/database.sql
    
    # Backup volumes
    docker run --rm -v predictionpump_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
    docker run --rm -v predictionpump_redis_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/redis_data.tar.gz -C /data .
    
    echo -e "${GREEN}✅ Backup created at $BACKUP_DIR${NC}"
}

# Build and deploy
deploy() {
    echo -e "${YELLOW}🔨 Building and deploying...${NC}"
    
    # Load environment variables
    export $(cat .env.${ENVIRONMENT} | xargs)
    
    # Build images
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    # Run database migrations
    echo -e "${YELLOW}📊 Running database migrations...${NC}"
    docker-compose -f docker-compose.prod.yml run --rm backend npm run migrate
    
    # Deploy services
    docker-compose -f docker-compose.prod.yml up -d
    
    echo -e "${GREEN}✅ Deployment completed${NC}"
}

# Health check
health_check() {
    echo -e "${YELLOW}🏥 Running health checks...${NC}"
    
    # Wait for services to start
    sleep 30
    
    # Check frontend
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is healthy${NC}"
    else
        echo -e "${RED}❌ Frontend health check failed${NC}"
        exit 1
    fi
    
    # Check backend
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
    else
        echo -e "${RED}❌ Backend health check failed${NC}"
        exit 1
    fi
    
    # Check database
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is healthy${NC}"
    else
        echo -e "${RED}❌ Database health check failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All health checks passed${NC}"
}

# Setup monitoring
setup_monitoring() {
    echo -e "${YELLOW}📊 Setting up monitoring...${NC}"
    
    # Import Grafana dashboards
    sleep 10
    curl -X POST \
        -H "Content-Type: application/json" \
        -d @monitoring/grafana/dashboards/dashboard.json \
        http://admin:${GRAFANA_PASSWORD}@localhost:3001/api/dashboards/db
    
    echo -e "${GREEN}✅ Monitoring setup completed${NC}"
}

# Cleanup old images
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    
    docker image prune -f
    docker volume prune -f
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Rollback function
rollback() {
    echo -e "${YELLOW}⏪ Rolling back deployment...${NC}"
    
    # Stop current services
    docker-compose -f docker-compose.prod.yml down
    
    # Restore database
    if [ -f "$BACKUP_DIR/database.sql" ]; then
        docker-compose -f docker-compose.prod.yml up -d postgres
        sleep 10
        docker-compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d predictionpump < $BACKUP_DIR/database.sql
    fi
    
    # Restore volumes
    if [ -f "$BACKUP_DIR/postgres_data.tar.gz" ]; then
        docker run --rm -v predictionpump_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data
    fi
    
    if [ -f "$BACKUP_DIR/redis_data.tar.gz" ]; then
        docker run --rm -v predictionpump_redis_data:/data -v $BACKUP_DIR:/backup alpine tar xzf /backup/redis_data.tar.gz -C /data
    fi
    
    echo -e "${GREEN}✅ Rollback completed${NC}"
}

# Main deployment flow
main() {
    case "${2:-deploy}" in
        "deploy")
            check_prerequisites
            create_backup
            deploy
            health_check
            setup_monitoring
            cleanup
            echo -e "${GREEN}🎉 Deployment successful!${NC}"
            ;;
        "rollback")
            rollback
            echo -e "${GREEN}🎉 Rollback successful!${NC}"
            ;;
        "health")
            health_check
            ;;
        *)
            echo "Usage: $0 [environment] [deploy|rollback|health]"
            exit 1
            ;;
    esac
}

# Trap errors and rollback
trap 'echo -e "${RED}❌ Deployment failed. Rolling back...${NC}"; rollback' ERR

main "$@"
import { NextApiRequest, NextApiResponse } from 'next';

// Simple metrics collection for Prometheus
let requestCount = 0;
let errorCount = 0;
let responseTimeSum = 0;
let responseTimeCount = 0;

// Middleware to track metrics
export function trackMetrics(req: NextApiRequest, startTime: number, statusCode: number) {
  requestCount++;
  
  if (statusCode >= 400) {
    errorCount++;
  }
  
  const responseTime = Date.now() - startTime;
  responseTimeSum += responseTime;
  responseTimeCount++;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const avgResponseTime = responseTimeCount > 0 ? responseTimeSum / responseTimeCount : 0;
  const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
  
  // Prometheus format metrics
  const metrics = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} ${requestCount - errorCount}
http_requests_total{method="GET",status="4xx"} ${errorCount}
http_requests_total{method="GET",status="5xx"} 0

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_sum ${responseTimeSum / 1000}
http_request_duration_seconds_count ${responseTimeCount}

# HELP http_requests_error_rate HTTP error rate
# TYPE http_requests_error_rate gauge
http_requests_error_rate ${errorRate}

# HELP nodejs_memory_usage_bytes Node.js memory usage in bytes
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="heap_used"} ${process.memoryUsage().heapUsed}
nodejs_memory_usage_bytes{type="heap_total"} ${process.memoryUsage().heapTotal}
nodejs_memory_usage_bytes{type="external"} ${process.memoryUsage().external}

# HELP nodejs_uptime_seconds Node.js uptime in seconds
# TYPE nodejs_uptime_seconds gauge
nodejs_uptime_seconds ${process.uptime()}

# HELP websocket_connections_active Active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active 0

# HELP trading_volume_total Total trading volume
# TYPE trading_volume_total counter
trading_volume_total 0
`.trim();

  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(metrics);
}
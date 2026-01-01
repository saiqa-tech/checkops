# Performance Monitoring Guide (v3.0.0)

Learn how to leverage CheckOps v3.0.0's advanced performance monitoring capabilities for production environments.

## Overview

CheckOps v3.0.0 introduces enterprise-grade performance monitoring with:
- Real-time metrics collection
- Intelligent alerting system
- Health status assessment
- Performance trend analysis
- Production-ready monitoring endpoints

## Quick Start

### Basic Monitoring Setup

```javascript
import CheckOps, { 
    productionMetrics, 
    metricsCollector,
    metricsMiddleware 
} from '@saiqa-tech/checkops';

// Initialize CheckOps
const checkops = new CheckOps(config);
await checkops.initialize();

// Start monitoring with 1-minute intervals
productionMetrics.startMonitoring(60000);

// For Express applications
app.use(metricsMiddleware());
```

### Environment Configuration

```env
# Enable monitoring features
ENABLE_MONITORING=true
MONITORING_INTERVAL=60000

# Configure alert thresholds
ALERT_QUERY_TIME_THRESHOLD=1000
ALERT_ERROR_RATE_THRESHOLD=5
ALERT_CACHE_HIT_RATE_THRESHOLD=0.8
ALERT_MEMORY_USAGE_THRESHOLD=500000000
```

## Core Monitoring Features

### 1. Real-Time Metrics Collection

```javascript
// Get comprehensive performance metrics
const metrics = productionMetrics.exportMetricsReport('json');

console.log('Performance Metrics:', {
    queries: metrics.queries,
    operations: metrics.operations,
    cache: metrics.cache,
    system: metrics.system
});
```

**Available Metrics:**
- **Query Performance**: Average time, error rates, queries per second
- **Operation Tracking**: Individual and batch operation metrics
- **Cache Efficiency**: Hit rates, miss rates, operation timing
- **System Resources**: Memory usage, CPU usage, uptime tracking

### 2. Health Status Assessment

```javascript
// Get system health status
const health = productionMetrics.getHealthStatus();

console.log('System Health:', health);
// Returns: { 
//   status: 'HEALTHY' | 'WARNING' | 'CRITICAL',
//   details: { ... },
//   alerts: [ ... ],
//   timestamp: '2025-01-01T00:00:00.000Z'
// }
```

**Health Status Levels:**
- **HEALTHY**: All systems operating normally
- **WARNING**: Performance degradation detected
- **CRITICAL**: System issues requiring immediate attention

### 3. Performance Trend Analysis

```javascript
// Analyze performance trends over time
const trends = productionMetrics.getPerformanceTrends(60); // Last 60 minutes

console.log('Performance Trends:', {
    queryTimeChange: trends.queryTimeChange,
    errorRateChange: trends.errorRateChange,
    cacheHitRateChange: trends.cacheHitRateChange
});
```

### 4. Intelligent Alerting

```javascript
// Configure custom alert thresholds
productionMetrics.updateAlertThresholds({
    queryTime: 500,      // 500ms query time threshold
    errorRate: 2,        // 2% error rate threshold
    cacheHitRate: 0.9,   // 90% cache hit rate threshold
    memoryUsage: 1024 * 1024 * 1024 // 1GB memory threshold
});

// Listen for alerts
productionMetrics.on('alert', (alert) => {
    console.log('Performance Alert:', alert);
    // Send to monitoring system (Slack, PagerDuty, etc.)
});
```

## Production Integration

### Express.js Integration

```javascript
import express from 'express';
import { metricsMiddleware, getHealthCheckData } from '@saiqa-tech/checkops';

const app = express();

// Add metrics middleware for automatic request monitoring
app.use(metricsMiddleware());

// Health check endpoint for load balancers
app.get('/health', (req, res) => {
    const health = getHealthCheckData();
    const status = health.health.status === 'HEALTHY' ? 200 : 503;
    res.status(status).json(health);
});

// Metrics endpoint for monitoring systems (Prometheus, etc.)
app.get('/metrics', (req, res) => {
    const metrics = productionMetrics.exportMetricsReport('text');
    res.set('Content-Type', 'text/plain').send(metrics);
});

// Detailed metrics endpoint
app.get('/api/metrics/detailed', (req, res) => {
    const metrics = productionMetrics.exportMetricsReport('json');
    res.json(metrics);
});
```

### Docker Health Checks

```dockerfile
# Add health check to Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Kubernetes Probes

```yaml
# kubernetes-deployment.yml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Advanced Monitoring Patterns

### 1. Custom Metrics Collection

```javascript
import { metricsCollector } from '@saiqa-tech/checkops';

// Record custom operations
const start = performance.now();
try {
    const result = await customOperation();
    const duration = performance.now() - start;
    metricsCollector.recordOperation('custom_operation', duration);
    return result;
} catch (error) {
    const duration = performance.now() - start;
    metricsCollector.recordOperation('custom_operation', duration, error);
    throw error;
}
```

### 2. Batch Operation Monitoring

```javascript
import { recordBatchOperation } from '@saiqa-tech/checkops';

// Monitor batch operations automatically
const bulkCreateForms = recordBatchOperation(
    'bulk_create_forms',
    forms.length,
    async () => await checkops.bulkCreateForms(forms)
);

const results = await bulkCreateForms();
```

### 3. Performance Regression Detection

```javascript
// Set up automated performance regression detection
setInterval(() => {
    const trends = productionMetrics.getPerformanceTrends(30);
    
    if (trends.queryTimeChange > 50) { // 50% increase in query time
        console.warn('Performance regression detected:', trends);
        // Alert development team
    }
}, 300000); // Check every 5 minutes
```

## Monitoring Best Practices

### 1. Alert Configuration

```javascript
// Production alert thresholds
const productionThresholds = {
    queryTime: 1000,        // 1 second
    errorRate: 5,           // 5%
    cacheHitRate: 0.8,      // 80%
    memoryUsage: 500 * 1024 * 1024, // 500MB
    connectionUtilization: 0.9 // 90%
};

// Development alert thresholds (more lenient)
const developmentThresholds = {
    queryTime: 2000,        // 2 seconds
    errorRate: 10,          // 10%
    cacheHitRate: 0.6,      // 60%
    memoryUsage: 1024 * 1024 * 1024, // 1GB
    connectionUtilization: 0.95 // 95%
};

const thresholds = process.env.NODE_ENV === 'production' 
    ? productionThresholds 
    : developmentThresholds;

productionMetrics.updateAlertThresholds(thresholds);
```

### 2. Monitoring Intervals

```javascript
// Configure monitoring intervals based on environment
const monitoringInterval = {
    production: 30000,   // 30 seconds
    staging: 60000,      // 1 minute
    development: 120000  // 2 minutes
}[process.env.NODE_ENV] || 60000;

productionMetrics.startMonitoring(monitoringInterval);
```

### 3. Metrics Export Integration

```javascript
// Export metrics to external monitoring systems
setInterval(async () => {
    const metrics = productionMetrics.exportMetricsReport('json');
    
    // Send to monitoring service
    await sendToDatadog(metrics);
    await sendToNewRelic(metrics);
    await sendToPrometheus(metrics);
}, 60000);
```

## Troubleshooting

### Common Issues

1. **High Memory Usage Alerts**
   ```javascript
   // Check cache statistics
   const cacheStats = checkops.getCacheStats();
   if (cacheStats.size > 1000) {
       await checkops.clearCache('all');
   }
   ```

2. **Slow Query Performance**
   ```javascript
   // Analyze query patterns
   const metrics = productionMetrics.exportMetricsReport('json');
   console.log('Slow queries:', metrics.queries.slowQueries);
   ```

3. **Connection Pool Exhaustion**
   ```javascript
   // Monitor connection utilization
   const health = productionMetrics.getHealthStatus();
   if (health.details.connectionUtilization > 0.9) {
       console.warn('Connection pool near capacity');
   }
   ```

### Performance Optimization

1. **Cache Optimization**
   ```javascript
   // Monitor cache performance
   const cacheStats = checkops.getCacheStats();
   if (cacheStats.hitRate < 0.8) {
       // Increase cache TTL or size
       checkops.configureCaching({
           ttl: 600000, // 10 minutes
           maxSize: 200
       });
   }
   ```

2. **Query Optimization**
   ```javascript
   // Enable query optimization features
   const optimizedCheckops = new CheckOps({
       ...config,
       enableQueryOptimization: true,
       batchSize: 100,
       enableCaching: true
   });
   ```

## Integration Examples

### Slack Alerts

```javascript
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_TOKEN);

productionMetrics.on('alert', async (alert) => {
    if (alert.severity === 'CRITICAL') {
        await slack.chat.postMessage({
            channel: '#alerts',
            text: `🚨 CheckOps Alert: ${alert.message}`,
            attachments: [{
                color: 'danger',
                fields: [{
                    title: 'Details',
                    value: JSON.stringify(alert.details, null, 2),
                    short: false
                }]
            }]
        });
    }
});
```

### PagerDuty Integration

```javascript
import PagerDuty from 'pagerduty';

const pd = new PagerDuty(process.env.PAGERDUTY_API_KEY);

productionMetrics.on('alert', async (alert) => {
    if (alert.severity === 'CRITICAL') {
        await pd.incidents.create({
            incident: {
                type: 'incident',
                title: `CheckOps Performance Alert: ${alert.message}`,
                service: {
                    id: process.env.PAGERDUTY_SERVICE_ID,
                    type: 'service_reference'
                },
                body: {
                    type: 'incident_body',
                    details: JSON.stringify(alert.details, null, 2)
                }
            }
        });
    }
});
```

This comprehensive monitoring system provides complete visibility into your CheckOps application performance and enables proactive issue detection and resolution.
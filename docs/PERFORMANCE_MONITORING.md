# Performance Monitoring Guide (v3.0.0)

CheckOps v3.0.0 introduces comprehensive performance monitoring capabilities for production environments. This guide covers all monitoring features, metrics, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Metrics Collection](#metrics-collection)
3. [Production Metrics](#production-metrics)
4. [Monitoring Wrappers](#monitoring-wrappers)
5. [Health Checks](#health-checks)
6. [Cache Performance](#cache-performance)
7. [Integration Examples](#integration-examples)
8. [Best Practices](#best-practices)

## Overview

CheckOps v3.0.0 provides built-in performance monitoring without requiring external dependencies. All metrics are collected in-memory and can be exported to your monitoring system of choice.

### Key Features

- **Real-time Metrics:** Track operations as they happen
- **Zero Dependencies:** No external monitoring tools required
- **Low Overhead:** Minimal performance impact (< 1ms per operation)
- **Flexible Export:** Export to Prometheus, Datadog, CloudWatch, etc.
- **Production-Ready:** Battle-tested under high load

## Metrics Collection

### Basic Usage

```javascript
import CheckOps, { metricsCollector } from '@saiqa-tech/checkops';

const checkops = new CheckOps(config);
await checkops.initialize();

// Metrics are collected automatically
await checkops.createForm({ ... });

// Get current metrics
const metrics = metricsCollector.getMetrics();
console.log(metrics);
```

### Available Metrics

#### Operation Metrics
```javascript
{
  operations: Map {
    'createForm' => {
      count: 150,
      totalTime: 2500,  // milliseconds
      avgTime: 16.67,   // milliseconds
      minTime: 10,
      maxTime: 45,
      errors: 2
    },
    'createSubmission' => { ... },
    // ... other operations
  }
}
```

#### Cache Metrics
```javascript
{
  cacheHits: 1250,
  cacheMisses: 180,
  cacheHitRate: 0.874  // 87.4%
}
```

#### Batch Operation Metrics
```javascript
{
  batchOperations: Map {
    'bulkCreateForms' => {
      count: 5,
      totalRecords: 500,
      avgBatchSize: 100,
      totalTime: 1200,
      avgTime: 240,
      errors: 0
    }
  }
}
```

#### Validation Metrics
```javascript
{
  validations: {
    count: 5000,
    totalTime: 850,
    avgTime: 0.17,
    errors: 45
  }
}
```

#### Connection Metrics
```javascript
{
  connections: {
    active: 8,
    total: 1500,
    errors: 3
  }
}
```

### Resetting Metrics

```javascript
// Reset all metrics
metricsCollector.reset();

// Metrics start fresh
const metrics = metricsCollector.getMetrics();
// All counters back to 0
```

## Production Metrics

### Express.js Middleware

```javascript
import express from 'express';
import { metricsMiddleware } from '@saiqa-tech/checkops';

const app = express();

// Add metrics middleware
app.use(metricsMiddleware);

// Your routes
app.post('/api/forms', async (req, res) => {
  // Metrics automatically tracked
  const form = await checkops.createForm(req.body);
  res.json({ form });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
});
```

### Production Metrics API

```javascript
import { productionMetrics } from '@saiqa-tech/checkops';

// Record custom metrics
productionMetrics.recordOperation('customOperation', 150); // 150ms

// Record errors
productionMetrics.recordError('createForm', new Error('Validation failed'));

// Record cache operations
productionMetrics.recordCacheHit();
productionMetrics.recordCacheMiss();

// Get all metrics
const metrics = productionMetrics.getMetrics();
```

### Prometheus Export

```javascript
import { metricsCollector } from '@saiqa-tech/checkops';

app.get('/metrics/prometheus', (req, res) => {
  const metrics = metricsCollector.getMetrics();
  
  let prometheus = '';
  
  // Operation metrics
  metrics.operations.forEach((stats, operation) => {
    prometheus += `checkops_operation_count{operation="${operation}"} ${stats.count}\n`;
    prometheus += `checkops_operation_duration_ms{operation="${operation}"} ${stats.avgTime}\n`;
    prometheus += `checkops_operation_errors{operation="${operation}"} ${stats.errors}\n`;
  });
  
  // Cache metrics
  prometheus += `checkops_cache_hits ${metrics.cacheHits}\n`;
  prometheus += `checkops_cache_misses ${metrics.cacheMisses}\n`;
  prometheus += `checkops_cache_hit_rate ${metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)}\n`;
  
  res.set('Content-Type', 'text/plain');
  res.send(prometheus);
});
```

## Monitoring Wrappers

### Function Monitoring

```javascript
import { withMonitoring } from '@saiqa-tech/checkops';

// Wrap any async function
const monitoredFunction = withMonitoring('myOperation', async (data) => {
  // Your logic here
  return await processData(data);
});

// Metrics automatically collected
await monitoredFunction(myData);
```

### Model Monitoring

```javascript
import { withModelMonitoring } from '@saiqa-tech/checkops';

class CustomModel {
  static async create(data) {
    return withModelMonitoring('CustomModel', 'create', async () => {
      // Your create logic
      return await db.insert(data);
    });
  }
  
  static async findById(id) {
    return withModelMonitoring('CustomModel', 'findById', async () => {
      // Your find logic
      return await db.findOne({ id });
    });
  }
}
```

### Batch Operation Monitoring

```javascript
import { recordBatchOperation } from '@saiqa-tech/checkops';

const bulkInsert = recordBatchOperation('bulkInsert', 100, async (records) => {
  // Batch size: 100
  return await db.insertMany(records);
});

// Metrics include batch size
await bulkInsert(myRecords);
```

## Health Checks

### Basic Health Check

```javascript
import { getHealthCheckData } from '@saiqa-tech/checkops';

app.get('/health', async (req, res) => {
  const health = await getHealthCheckData();
  
  const status = health.database.connected ? 200 : 503;
  res.status(status).json(health);
});
```

### Health Check Response

```javascript
{
  status: 'healthy',  // or 'unhealthy'
  timestamp: '2026-01-14T12:00:00.000Z',
  uptime: 3600,  // seconds
  database: {
    connected: true,
    responseTime: 5  // milliseconds
  },
  metrics: {
    operations: {
      total: 15000,
      errors: 12,
      errorRate: 0.0008  // 0.08%
    },
    cache: {
      hitRate: 0.874,
      size: 1250
    },
    performance: {
      avgResponseTime: 45,  // milliseconds
      p95ResponseTime: 120,
      p99ResponseTime: 250
    }
  }
}
```

### Custom Health Checks

```javascript
import { getHealthCheckData, metricsCollector } from '@saiqa-tech/checkops';

app.get('/health/detailed', async (req, res) => {
  const baseHealth = await getHealthCheckData();
  const metrics = metricsCollector.getMetrics();
  
  // Add custom checks
  const customHealth = {
    ...baseHealth,
    custom: {
      queueSize: await getQueueSize(),
      diskSpace: await checkDiskSpace(),
      memoryUsage: process.memoryUsage(),
    },
    thresholds: {
      errorRateOk: baseHealth.metrics.operations.errorRate < 0.01,
      cacheHitRateOk: baseHealth.metrics.cache.hitRate > 0.7,
      responseTimeOk: baseHealth.metrics.performance.avgResponseTime < 100,
    }
  };
  
  const status = Object.values(customHealth.thresholds).every(v => v) ? 200 : 503;
  res.status(status).json(customHealth);
});
```

## Cache Performance

### Cache Statistics

```javascript
const checkops = new CheckOps(config);
await checkops.initialize();

// Get cache stats
const cacheStats = checkops.getCacheStats();

console.log(cacheStats);
```

### Cache Stats Response

```javascript
{
  forms: {
    size: 150,
    hits: 1200,
    misses: 80,
    hitRate: 0.9375,  // 93.75%
    maxSize: 1000,
    evictions: 5
  },
  questions: {
    size: 500,
    hits: 3500,
    misses: 200,
    hitRate: 0.9459,
    maxSize: 5000,
    evictions: 0
  },
  stats: {
    size: 75,
    hits: 800,
    misses: 150,
    hitRate: 0.8421,
    maxSize: 100,
    evictions: 10
  },
  submissions: {
    size: 200,
    hits: 500,
    misses: 100,
    hitRate: 0.8333,
    maxSize: 500,
    evictions: 2
  },
  query: {
    size: 300,
    hits: 2000,
    misses: 300,
    hitRate: 0.8696,
    maxSize: 1000,
    evictions: 15
  },
  total: {
    size: 1225,
    hits: 8000,
    misses: 830,
    hitRate: 0.9060,
    maxSize: 7600,
    evictions: 32
  }
}
```

### Cache Management

```javascript
// Clear all caches
await checkops.clearCache('all');

// Clear specific cache type
await checkops.clearCache('form');
await checkops.clearCache('question');
await checkops.clearCache('stats');
await checkops.clearCache('submission');

// Clear specific item
await checkops.clearCache('form', 'FORM-001');
await checkops.clearCache('question', 'Q-001');
```

## Integration Examples

### Datadog Integration

```javascript
import { StatsD } from 'node-dogstatsd';
import { metricsCollector } from '@saiqa-tech/checkops';

const statsd = new StatsD();

// Send metrics every 10 seconds
setInterval(() => {
  const metrics = metricsCollector.getMetrics();
  
  // Operation metrics
  metrics.operations.forEach((stats, operation) => {
    statsd.gauge(`checkops.operation.count`, stats.count, [`operation:${operation}`]);
    statsd.gauge(`checkops.operation.avg_time`, stats.avgTime, [`operation:${operation}`]);
    statsd.gauge(`checkops.operation.errors`, stats.errors, [`operation:${operation}`]);
  });
  
  // Cache metrics
  statsd.gauge('checkops.cache.hits', metrics.cacheHits);
  statsd.gauge('checkops.cache.misses', metrics.cacheMisses);
  statsd.gauge('checkops.cache.hit_rate', metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses));
}, 10000);
```

### CloudWatch Integration

```javascript
import AWS from 'aws-sdk';
import { metricsCollector } from '@saiqa-tech/checkops';

const cloudwatch = new AWS.CloudWatch();

async function sendToCloudWatch() {
  const metrics = metricsCollector.getMetrics();
  
  const metricData = [];
  
  // Operation metrics
  metrics.operations.forEach((stats, operation) => {
    metricData.push({
      MetricName: 'OperationCount',
      Value: stats.count,
      Unit: 'Count',
      Dimensions: [{ Name: 'Operation', Value: operation }]
    });
    
    metricData.push({
      MetricName: 'OperationDuration',
      Value: stats.avgTime,
      Unit: 'Milliseconds',
      Dimensions: [{ Name: 'Operation', Value: operation }]
    });
  });
  
  await cloudwatch.putMetricData({
    Namespace: 'CheckOps',
    MetricData: metricData
  }).promise();
}

// Send every minute
setInterval(sendToCloudWatch, 60000);
```

### Grafana Dashboard

```javascript
// Expose metrics endpoint for Grafana
app.get('/api/metrics', (req, res) => {
  const metrics = metricsCollector.getMetrics();
  
  // Format for Grafana JSON datasource
  const grafanaMetrics = {
    operations: Array.from(metrics.operations.entries()).map(([name, stats]) => ({
      target: name,
      datapoints: [
        [stats.count, Date.now()],
        [stats.avgTime, Date.now()],
        [stats.errors, Date.now()]
      ]
    })),
    cache: {
      hitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses),
      hits: metrics.cacheHits,
      misses: metrics.cacheMisses
    }
  };
  
  res.json(grafanaMetrics);
});
```

## Best Practices

### 1. Monitor Key Operations

Focus on operations that impact user experience:

```javascript
// High-priority operations to monitor
const criticalOperations = [
  'createSubmission',  // User-facing
  'getForm',           // User-facing
  'getSubmissionStats' // Dashboard performance
];

// Alert if these operations slow down
const metrics = metricsCollector.getMetrics();
criticalOperations.forEach(op => {
  const stats = metrics.operations.get(op);
  if (stats && stats.avgTime > 100) {
    console.warn(`${op} is slow: ${stats.avgTime}ms`);
    // Send alert
  }
});
```

### 2. Set Up Alerts

```javascript
function checkMetricsHealth() {
  const metrics = metricsCollector.getMetrics();
  
  // Error rate alert
  metrics.operations.forEach((stats, operation) => {
    const errorRate = stats.errors / stats.count;
    if (errorRate > 0.01) {  // 1% error rate
      sendAlert(`High error rate for ${operation}: ${(errorRate * 100).toFixed(2)}%`);
    }
  });
  
  // Cache hit rate alert
  const cacheHitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses);
  if (cacheHitRate < 0.7) {  // 70% hit rate
    sendAlert(`Low cache hit rate: ${(cacheHitRate * 100).toFixed(2)}%`);
  }
  
  // Performance alert
  metrics.operations.forEach((stats, operation) => {
    if (stats.avgTime > 200) {  // 200ms threshold
      sendAlert(`Slow operation ${operation}: ${stats.avgTime}ms`);
    }
  });
}

// Check every minute
setInterval(checkMetricsHealth, 60000);
```

### 3. Regular Metric Exports

```javascript
// Export metrics to file for analysis
import fs from 'fs';

function exportMetrics() {
  const metrics = metricsCollector.getMetrics();
  const timestamp = new Date().toISOString();
  
  const export = {
    timestamp,
    metrics: {
      operations: Object.fromEntries(metrics.operations),
      batchOperations: Object.fromEntries(metrics.batchOperations),
      cache: {
        hits: metrics.cacheHits,
        misses: metrics.cacheMisses,
        hitRate: metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
      },
      validations: metrics.validations,
      connections: metrics.connections
    }
  };
  
  fs.appendFileSync(
    'metrics.jsonl',
    JSON.stringify(exportData) + '\n'
  );
}

// Export every hour
setInterval(exportMetrics, 3600000);
```

### 4. Performance Baselines

```javascript
// Establish performance baselines
const baselines = {
  createForm: { avgTime: 50, maxTime: 150 },
  createSubmission: { avgTime: 30, maxTime: 100 },
  getForm: { avgTime: 10, maxTime: 50 },
  getSubmissionStats: { avgTime: 80, maxTime: 200 }
};

function checkAgainstBaselines() {
  const metrics = metricsCollector.getMetrics();
  
  Object.entries(baselines).forEach(([operation, baseline]) => {
    const stats = metrics.operations.get(operation);
    if (!stats) return;
    
    if (stats.avgTime > baseline.avgTime * 1.5) {
      console.warn(`${operation} is 50% slower than baseline`);
    }
    
    if (stats.maxTime > baseline.maxTime * 2) {
      console.error(`${operation} max time is 2x baseline`);
    }
  });
}
```

### 5. Memory Management

```javascript
// Reset metrics periodically to prevent memory growth
setInterval(() => {
  // Export before reset
  exportMetrics();
  
  // Reset metrics
  metricsCollector.reset();
  
  console.log('Metrics reset');
}, 24 * 60 * 60 * 1000);  // Every 24 hours
```

### 6. Correlation with Business Metrics

```javascript
// Correlate performance with business metrics
async function analyzePerformanceImpact() {
  const metrics = metricsCollector.getMetrics();
  const submissionStats = metrics.operations.get('createSubmission');
  
  if (submissionStats.avgTime > 100) {
    // Slow submissions might impact conversion rate
    const conversionRate = await getConversionRate();
    
    console.log({
      avgSubmissionTime: submissionStats.avgTime,
      conversionRate,
      correlation: 'Investigate if slow submissions hurt conversions'
    });
  }
}
```

## Troubleshooting

### High Memory Usage

```javascript
// Check cache sizes
const cacheStats = checkops.getCacheStats();

if (cacheStats.total.size > 10000) {
  console.warn('Cache size is large, consider clearing');
  await checkops.clearCache('all');
}
```

### Slow Operations

```javascript
// Identify slow operations
const metrics = metricsCollector.getMetrics();

const slowOps = Array.from(metrics.operations.entries())
  .filter(([_, stats]) => stats.avgTime > 100)
  .sort((a, b) => b[1].avgTime - a[1].avgTime);

console.log('Slow operations:', slowOps);
```

### High Error Rates

```javascript
// Identify operations with high error rates
const metrics = metricsCollector.getMetrics();

const errorProneOps = Array.from(metrics.operations.entries())
  .map(([name, stats]) => ({
    name,
    errorRate: stats.errors / stats.count,
    errors: stats.errors,
    total: stats.count
  }))
  .filter(op => op.errorRate > 0.01)
  .sort((a, b) => b.errorRate - a.errorRate);

console.log('Error-prone operations:', errorProneOps);
```

## Conclusion

CheckOps v3.0.0 provides comprehensive performance monitoring out of the box. Use these tools to:

- Track operation performance
- Monitor cache effectiveness
- Identify bottlenecks
- Set up alerts
- Export to your monitoring system

For more information, see:
- [API Reference](./API_REFERENCE.md)
- [Architecture](./ARCHITECTURE.md)
- [Batch Operations Guide](./BATCH_OPERATIONS.md)

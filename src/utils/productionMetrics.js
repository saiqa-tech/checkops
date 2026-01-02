/**
 * Phase 4.3: Production Metrics Collection
 * Real-time monitoring and alerting for production environments
 */

import { metricsCollector } from './metrics.js';
import { getMetrics as getDbMetrics } from '../config/database.js';

export class ProductionMetricsCollector {
    constructor() {
        this.alertThresholds = {
            queryTime: 1000, // 1 second
            errorRate: 5, // 5%
            cacheHitRate: 0.8, // 80%
            memoryUsage: 500 * 1024 * 1024, // 500MB
            connectionUtilization: 0.9 // 90%
        };

        this.alerts = [];
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.metricsHistory = [];
        this.maxHistorySize = 1000; // Keep last 1000 data points
        this.maxAlertsSize = 1000; // Prevent alert memory leaks
    }

    startMonitoring(intervalMs = 60000) { // Default: 1 minute
        if (this.isMonitoring) {
            console.warn('Monitoring is already active');
            return;
        }

        this.isMonitoring = true;
        console.log(`Starting production metrics monitoring (interval: ${intervalMs}ms)`);

        this.monitoringInterval = setInterval(() => {
            this.collectAndAnalyzeMetrics();
        }, intervalMs);

        // Initial collection
        this.collectAndAnalyzeMetrics();
    }

    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        console.log('Production metrics monitoring stopped');
    }

    collectAndAnalyzeMetrics() {
        const timestamp = new Date().toISOString();
        const appMetrics = metricsCollector.getMetrics();
        const dbMetrics = getDbMetrics();
        const systemMetrics = this.getSystemMetrics();

        const combinedMetrics = {
            timestamp,
            application: appMetrics,
            database: dbMetrics,
            system: systemMetrics
        };

        // Store in history
        this.metricsHistory.push(combinedMetrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory.shift();
        }

        // Analyze for alerts
        this.analyzeMetricsForAlerts(combinedMetrics);

        return combinedMetrics;
    }

    getSystemMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                heapUtilization: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };
    }

    analyzeMetricsForAlerts(metrics) {
        const alerts = [];

        // Check query performance
        if (metrics.application.queries.avgTime > this.alertThresholds.queryTime) {
            alerts.push({
                type: 'PERFORMANCE',
                severity: 'WARNING',
                message: `Average query time (${metrics.application.queries.avgTime.toFixed(2)}ms) exceeds threshold (${this.alertThresholds.queryTime}ms)`,
                value: metrics.application.queries.avgTime,
                threshold: this.alertThresholds.queryTime,
                timestamp: metrics.timestamp
            });
        }

        // Check error rate
        if (metrics.application.queries.errorRate > this.alertThresholds.errorRate) {
            alerts.push({
                type: 'ERROR_RATE',
                severity: 'CRITICAL',
                message: `Query error rate (${metrics.application.queries.errorRate.toFixed(2)}%) exceeds threshold (${this.alertThresholds.errorRate}%)`,
                value: metrics.application.queries.errorRate,
                threshold: this.alertThresholds.errorRate,
                timestamp: metrics.timestamp
            });
        }

        // Check cache hit rate
        if (metrics.application.cache.hitRate < this.alertThresholds.cacheHitRate) {
            alerts.push({
                type: 'CACHE_PERFORMANCE',
                severity: 'WARNING',
                message: `Cache hit rate (${(metrics.application.cache.hitRate * 100).toFixed(1)}%) below threshold (${(this.alertThresholds.cacheHitRate * 100)}%)`,
                value: metrics.application.cache.hitRate,
                threshold: this.alertThresholds.cacheHitRate,
                timestamp: metrics.timestamp
            });
        }

        // Check memory usage
        if (metrics.system.memory.heapUsed > this.alertThresholds.memoryUsage) {
            alerts.push({
                type: 'MEMORY_USAGE',
                severity: 'WARNING',
                message: `Memory usage (${(metrics.system.memory.heapUsed / 1024 / 1024).toFixed(2)}MB) exceeds threshold (${(this.alertThresholds.memoryUsage / 1024 / 1024)}MB)`,
                value: metrics.system.memory.heapUsed,
                threshold: this.alertThresholds.memoryUsage,
                timestamp: metrics.timestamp
            });
        }

        // Check database connection utilization
        if (metrics.database && metrics.database.totalCount > 0) {
            const utilization = (metrics.database.totalCount - metrics.database.idleCount) / metrics.database.totalCount;
            if (utilization > this.alertThresholds.connectionUtilization) {
                alerts.push({
                    type: 'CONNECTION_UTILIZATION',
                    severity: 'WARNING',
                    message: `Database connection utilization (${(utilization * 100).toFixed(1)}%) exceeds threshold (${(this.alertThresholds.connectionUtilization * 100)}%)`,
                    value: utilization,
                    threshold: this.alertThresholds.connectionUtilization,
                    timestamp: metrics.timestamp
                });
            }
        }

        // Store and emit alerts
        if (alerts.length > 0) {
            this.alerts.push(...alerts);

            // Prevent memory leaks by limiting alert history
            if (this.alerts.length > this.maxAlertsSize) {
                this.alerts.splice(0, this.alerts.length - this.maxAlertsSize);
            }

            this.emitAlerts(alerts);
        }
    }

    emitAlerts(alerts) {
        alerts.forEach(alert => {
            console.warn(`[ALERT] ${alert.severity}: ${alert.message}`);

            // In production, you might want to send to external monitoring systems
            // this.sendToExternalMonitoring(alert);
        });
    }

    getHealthStatus() {
        const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
        if (!latestMetrics) {
            return { status: 'UNKNOWN', message: 'No metrics available' };
        }

        const recentAlerts = this.alerts.filter(alert =>
            new Date(alert.timestamp) > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        );

        const criticalAlerts = recentAlerts.filter(alert => alert.severity === 'CRITICAL');
        const warningAlerts = recentAlerts.filter(alert => alert.severity === 'WARNING');

        if (criticalAlerts.length > 0) {
            return {
                status: 'CRITICAL',
                message: `${criticalAlerts.length} critical alert(s) in the last 5 minutes`,
                alerts: criticalAlerts
            };
        }

        if (warningAlerts.length > 0) {
            return {
                status: 'WARNING',
                message: `${warningAlerts.length} warning(s) in the last 5 minutes`,
                alerts: warningAlerts
            };
        }

        return {
            status: 'HEALTHY',
            message: 'All systems operating normally',
            metrics: latestMetrics
        };
    }

    getPerformanceTrends(timeRangeMinutes = 60) {
        const cutoffTime = new Date(Date.now() - timeRangeMinutes * 60 * 1000);
        const recentMetrics = this.metricsHistory.filter(m =>
            new Date(m.timestamp) > cutoffTime
        );

        if (recentMetrics.length < 2) {
            return { message: 'Insufficient data for trend analysis' };
        }

        const first = recentMetrics[0];
        const last = recentMetrics[recentMetrics.length - 1];

        // Validate and coerce timeRangeMinutes to a finite number
        const validTimeRange = Number.isFinite(timeRangeMinutes) && timeRangeMinutes > 0 ? timeRangeMinutes : 60;
        const denominator = validTimeRange / 60;
        const queryCountChange = last.application.queries.count - first.application.queries.count;

        const trends = {
            queryTime: {
                start: first.application.queries.avgTime,
                end: last.application.queries.avgTime,
                change: last.application.queries.avgTime - first.application.queries.avgTime,
                percentChange: first.application.queries.avgTime > 0
                    ? ((last.application.queries.avgTime - first.application.queries.avgTime) / first.application.queries.avgTime) * 100
                    : null
            },
            cacheHitRate: {
                start: first.application.cache.hitRate,
                end: last.application.cache.hitRate,
                change: last.application.cache.hitRate - first.application.cache.hitRate,
                percentChange: first.application.cache.hitRate > 0
                    ? ((last.application.cache.hitRate - first.application.cache.hitRate) / first.application.cache.hitRate) * 100
                    : null
            },
            memoryUsage: {
                start: first.system.memory.heapUsed,
                end: last.system.memory.heapUsed,
                change: last.system.memory.heapUsed - first.system.memory.heapUsed,
                percentChange: first.system.memory.heapUsed > 0
                    ? ((last.system.memory.heapUsed - first.system.memory.heapUsed) / first.system.memory.heapUsed) * 100
                    : null
            },
            queryCount: {
                start: first.application.queries.count,
                end: last.application.queries.count,
                change: queryCountChange,
                rate: denominator > 0 && Number.isFinite(denominator) ? queryCountChange / denominator : null // per hour
            }
        };

        return {
            timeRange: `${validTimeRange} minutes`,
            dataPoints: recentMetrics.length,
            trends
        };
    }

    exportMetricsReport(format = 'json') {
        const healthStatus = this.getHealthStatus();
        const trends = this.getPerformanceTrends();
        const summary = metricsCollector.getPerformanceSummary();

        const report = {
            generatedAt: new Date().toISOString(),
            healthStatus,
            performanceSummary: summary,
            trends,
            recentAlerts: this.alerts.slice(-10), // Last 10 alerts
            configuration: {
                alertThresholds: this.alertThresholds,
                monitoringActive: this.isMonitoring,
                historySize: this.metricsHistory.length
            }
        };

        if (format === 'json') {
            return report;
        }

        // Simple text format
        return this.formatReportAsText(report);
    }

    formatReportAsText(report) {
        return `
CheckOps Performance Report
Generated: ${report.generatedAt}

HEALTH STATUS: ${report.healthStatus.status}
${report.healthStatus.message}

PERFORMANCE SUMMARY:
- Uptime: ${report.performanceSummary.overview.uptime}
- Total Queries: ${report.performanceSummary.overview.totalQueries}
- Avg Query Time: ${report.performanceSummary.overview.avgQueryTime}
- Cache Hit Rate: ${report.performanceSummary.overview.cacheHitRate}
- Error Rate: ${report.performanceSummary.overview.errorRate}

PERFORMANCE TRENDS:
- Query Time: ${report.trends.trends?.queryTime?.percentChange?.toFixed(1) || 'N/A'}% change
- Cache Hit Rate: ${report.trends.trends?.cacheHitRate?.percentChange?.toFixed(1) || 'N/A'}% change
- Memory Usage: ${report.trends.trends?.memoryUsage?.percentChange?.toFixed(1) || 'N/A'}% change

RECENT ALERTS: ${report.recentAlerts.length}
${report.recentAlerts.map(alert => `- ${alert.severity}: ${alert.message}`).join('\n')}
    `.trim();
    }

    updateAlertThresholds(newThresholds) {
        this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
        console.log('Alert thresholds updated:', this.alertThresholds);
    }

    clearAlerts() {
        const clearedCount = this.alerts.length;
        this.alerts = [];
        console.log(`Cleared ${clearedCount} alerts`);
    }

    getMetricsHistory(limit = 100) {
        return this.metricsHistory.slice(-limit);
    }
}

// Global production metrics collector
export const productionMetrics = new ProductionMetricsCollector();

/**
 * Express middleware for automatic metrics collection
 */
export function metricsMiddleware() {
    return (req, res, next) => {
        const start = performance.now();

        // Track request
        metricsCollector.recordOperation('http_request', 0);

        // Override res.end to capture response time
        const originalEnd = res.end;
        res.end = function (...args) {
            const duration = performance.now() - start;
            metricsCollector.recordOperation(`http_${req.method}_${res.statusCode}`, duration);

            // Track errors
            if (res.statusCode >= 400) {
                metricsCollector.recordOperation('http_error', duration, new Error(`HTTP ${res.statusCode}`));
            }

            originalEnd.apply(this, args);
        };

        next();
    };
}

/**
 * Health check endpoint data
 */
export function getHealthCheckData() {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        metrics: metricsCollector.getPerformanceSummary(),
        health: productionMetrics.getHealthStatus()
    };
}
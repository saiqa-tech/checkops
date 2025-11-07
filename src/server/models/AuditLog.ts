import { getDatabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

export interface AuditLogRow {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface AuditLogCreateRequest {
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogModel {
  private db = getDatabase();

  async createLog(request: AuditLogCreateRequest): Promise<AuditLogRow> {
    const query = `
      INSERT INTO audit_logs (
        entity_type, entity_id, action, old_values, new_values,
        user_id, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    try {
      const result = await this.db.queryOne<AuditLogRow>(query, [
        request.entityType,
        request.entityId,
        request.action,
        request.oldValues,
        request.newValues,
        request.userId,
        request.ipAddress,
        request.userAgent
      ]);

      if (!result) {
        throw new Error('Failed to create audit log entry');
      }

      logger.debug('Audit log created', {
        id: result.id,
        entityType: result.entityType,
        entityId: result.entityId,
        action: result.action,
        userId: result.userId
      });

      return result;
    } catch (error) {
      logger.error('Failed to create audit log', error);
      throw error;
    }
  }

  async getLogs(
    entityType?: string,
    entityId?: string,
    action?: string,
    userId?: string,
    limit: number = 50,
    offset: number = 0,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditLogRow[]> {
    let query = `
      SELECT * FROM audit_logs
    `;
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    if (entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(entityType);
      paramIndex++;
    }

    if (entityId) {
      conditions.push(`entity_id = $${paramIndex}`);
      params.push(entityId);
      paramIndex++;
    }

    if (action) {
      conditions.push(`action = $${paramIndex}`);
      params.push(action);
      paramIndex++;
    }

    if (userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    try {
      const logs = await this.db.query<AuditLogRow>(query, params);
      return logs;
    } catch (error) {
      logger.error('Failed to get audit logs', error);
      throw error;
    }
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<AuditLogRow[]> {
    const query = `
      SELECT * FROM audit_logs 
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    try {
      const logs = await this.db.query<AuditLogRow>(query, [entityType, entityId, limit]);
      return logs;
    } catch (error) {
      logger.error(`Failed to get entity history for ${entityType}:${entityId}`, error);
      throw error;
    }
  }

  async getUserActivity(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLogRow[]> {
    const query = `
      SELECT * FROM audit_logs 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const logs = await this.db.query<AuditLogRow>(query, [userId, limit, offset]);
      return logs;
    } catch (error) {
      logger.error(`Failed to get user activity for ${userId}`, error);
      throw error;
    }
  }

  async getAuditStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalLogs: number;
    actionsByType: Record<string, number>;
    entitiesByType: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (startDate || endDate) {
      const conditions = [];
      if (startDate) {
        conditions.push(`created_at >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }
      if (endDate) {
        conditions.push(`created_at <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    try {
      // Get total logs
      const totalQuery = `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`;
      const totalResult = await this.db.queryOne<{ count: string }>(totalQuery, params);
      const totalLogs = parseInt(totalResult?.count || '0');

      // Get actions by type
      const actionsQuery = `
        SELECT action, COUNT(*) as count 
        FROM audit_logs ${whereClause}
        GROUP BY action
        ORDER BY count DESC
      `;
      const actionsResult = await this.db.query<{ action: string; count: string }>(actionsQuery, params);
      const actionsByType = actionsResult.reduce((acc, row) => {
        acc[row.action] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get entities by type
      const entitiesQuery = `
        SELECT entity_type, COUNT(*) as count 
        FROM audit_logs ${whereClause}
        GROUP BY entity_type
        ORDER BY count DESC
      `;
      const entitiesResult = await this.db.query<{ entity_type: string; count: string }>(entitiesQuery, params);
      const entitiesByType = entitiesResult.reduce((acc, row) => {
        acc[row.entity_type] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // Get top users
      const usersQuery = `
        SELECT user_id, COUNT(*) as count 
        FROM audit_logs 
        WHERE user_id IS NOT NULL
        ${startDate || endDate ? 'AND ' + whereClause.replace('WHERE ', '') : ''}
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 10
      `;
      const usersResult = await this.db.query<{ user_id: string; count: string }>(usersQuery, params);
      const topUsers = usersResult.map(row => ({
        userId: row.user_id,
        count: parseInt(row.count)
      }));

      return {
        totalLogs,
        actionsByType,
        entitiesByType,
        topUsers
      };
    } catch (error) {
      logger.error('Failed to get audit stats', error);
      throw error;
    }
  }

  async archiveOldLogs(olderThanDays: number = 365): Promise<number> {
    // In a real implementation, you might move old logs to a separate archive table
    // For now, we'll just return the count of logs that would be affected
    const query = `
      SELECT COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
    `;

    try {
      const result = await this.db.queryOne<{ count: string }>(query);
      const count = parseInt(result?.count || '0');
      
      logger.info(`Found ${count} audit logs older than ${olderThanDays} days for archiving`);
      return count;
    } catch (error) {
      logger.error(`Failed to count old audit logs for archiving`, error);
      throw error;
    }
  }
}

// Audit log service for easy integration
export class AuditLogService {
  private auditLogModel: AuditLogModel;

  constructor() {
    this.auditLogModel = new AuditLogModel();
  }

  async logCreate(
    entityType: string,
    entityId: string,
    newValues: Record<string, any>,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.auditLogModel.createLog({
      entityType,
      entityId,
      action: 'create',
      newValues,
      userId,
      ipAddress,
      userAgent
    });
  }

  async logUpdate(
    entityType: string,
    entityId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.auditLogModel.createLog({
      entityType,
      entityId,
      action: 'update',
      oldValues,
      newValues,
      userId,
      ipAddress,
      userAgent
    });
  }

  async logDelete(
    entityType: string,
    entityId: string,
    oldValues: Record<string, any>,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.auditLogModel.createLog({
      entityType,
      entityId,
      action: 'delete',
      oldValues,
      userId,
      ipAddress,
      userAgent
    });
  }

  async logView(
    entityType: string,
    entityId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.auditLogModel.createLog({
      entityType,
      entityId,
      action: 'view',
      userId,
      ipAddress,
      userAgent
    });
  }

  async logCustom(
    entityType: string,
    entityId: string,
    action: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.auditLogModel.createLog({
      entityType,
      entityId,
      action,
      oldValues,
      newValues,
      userId,
      ipAddress,
      userAgent
    });
  }

  getAuditLogModel(): AuditLogModel {
    return this.auditLogModel;
  }
}

// Singleton instance
export const auditLogService = new AuditLogService();
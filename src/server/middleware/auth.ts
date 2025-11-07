import { Request, Response, NextFunction } from 'express';
import { ApiKeyModel } from '../models/ApiKey.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
    rateLimitPerHour: number;
  };
}

export class AuthMiddleware {
  private apiKeyModel: ApiKeyModel;

  constructor() {
    this.apiKeyModel = new ApiKeyModel();
  }

  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(401).json({ error: 'Missing authorization header' });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({ error: 'Invalid authorization header format' });
        return;
      }

      const apiKey = parts[1];
      const keyRecord = await this.apiKeyModel.validateApiKey(apiKey);

      if (!keyRecord) {
        logger.warn('Invalid API key attempted', { 
          ip: req.ip, 
          userAgent: req.get('User-Agent'),
          apiKey: apiKey.substring(0, 8) + '...' 
        });
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      req.apiKey = {
        id: keyRecord.id,
        name: keyRecord.name,
        permissions: keyRecord.permissions,
        rateLimitPerHour: keyRecord.rateLimitPerHour
      };

      logger.debug('API key authenticated successfully', { 
        keyId: keyRecord.id, 
        keyName: keyRecord.name,
        ip: req.ip 
      });

      next();
    } catch (error) {
      logger.error('Authentication error', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };

  requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.apiKey) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const hasPermission = this.apiKeyModel.hasPermission(req.apiKey as any, permission);
      
      if (!hasPermission) {
        logger.warn('Insufficient permissions', { 
          keyId: req.apiKey.id, 
          requiredPermission: permission,
          permissions: req.apiKey.permissions,
          ip: req.ip 
        });
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      logger.debug('Permission check passed', { 
        keyId: req.apiKey.id, 
        permission 
      });

      next();
    };
  };

  optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        next();
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        next();
        return;
      }

      const apiKey = parts[1];
      const keyRecord = await this.apiKeyModel.validateApiKey(apiKey);

      if (keyRecord) {
        req.apiKey = {
          id: keyRecord.id,
          name: keyRecord.name,
          permissions: keyRecord.permissions,
          rateLimitPerHour: keyRecord.rateLimitPerHour
        };

        logger.debug('Optional API key authentication successful', { 
          keyId: keyRecord.id,
          ip: req.ip 
        });
      }

      next();
    } catch (error) {
      logger.error('Optional authentication error', error);
      // For optional auth, we don't fail the request
      next();
    }
  };
}

export const authMiddleware = new AuthMiddleware();
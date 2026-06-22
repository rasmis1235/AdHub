import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  const response: ApiResponse<T> = { success: true, data, message };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 400,
  errors?: Record<string, string[]>
): void {
  const response: ApiResponse = { success: false, error: message, errors };
  res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  result: PaginatedResponse<T>,
  statusCode: number = 200
): void {
  res.status(statusCode).json({ success: true, ...result });
}

export function paginate(
  total: number,
  page: number,
  limit: number
): PaginatedResponse<never>['pagination'] {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function getPaginationParams(
  queryPage?: string,
  queryLimit?: string,
  maxLimit: number = 100
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(queryPage || '1') || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(queryLimit || '20') || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

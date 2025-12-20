// Shared TypeScript types across services

export interface BaseResponse<T = unknown> {
  message: string;
  payload?: T;
}

export interface ErrorResponse {
  message: string;
  errors?: Record<string, string>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> extends BaseResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

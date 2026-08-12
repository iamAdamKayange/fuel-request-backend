export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: any
}

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
  }
}

export function errorResponse(message: string, error?: any): ApiResponse {
  return {
    success: false,
    message,
    error,
  }
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}
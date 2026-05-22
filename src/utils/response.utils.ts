import { Response } from 'express';

interface SuccessResponse {
  success: true;
  message?: string;
  data?: any;
  meta?: any;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: any;
}

export const sendSuccess = (
  res: Response,
  data?: any,
  message?: string,
  statusCode: number = 200,
  meta?: any
): Response => {
  const response: SuccessResponse = {
    success: true,
    ...(message && { message }),
    ...(data && { data }),
    ...(meta && { meta })
  };

  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  errors?: any
): Response => {
  const response: ErrorResponse = {
    success: false,
    message,
    ...(errors && { errors })
  };

  return res.status(statusCode).json(response);
};

export const sendCreated = (
  res: Response,
  data: any,
  message: string = 'Recurso creado exitosamente'
): Response => {
  return sendSuccess(res, data, message, 201);
};

export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};

export const sendPaginated = (
  res: Response,
  data: any[],
  total: number,
  page: number,
  limit: number,
  message?: string
): Response => {
  const totalPages = Math.ceil(total / limit);
  
  return sendSuccess(
    res,
    data,
    message,
    200,
    {
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  );
};
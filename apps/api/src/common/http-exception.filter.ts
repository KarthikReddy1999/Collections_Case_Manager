import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const payload =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as Record<string, unknown>);

    const requestId = request.requestId ?? null;

    const logPayload: Record<string, unknown> = {
      level: status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'error' : 'warn',
      message: 'http_error',
      timestamp: new Date().toISOString(),
      requestId,
      path: request.url,
      method: request.method,
      statusCode: status,
      errorMessage: payload.message ?? 'Request failed',
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error) {
      logPayload.stack = exception.stack;
    }

    console.log(JSON.stringify(logPayload));

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message: payload.message ?? 'Request failed',
        details: payload.details ?? null,
        path: request.url,
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

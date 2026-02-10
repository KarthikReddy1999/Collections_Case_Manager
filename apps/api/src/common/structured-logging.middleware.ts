import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class StructuredLoggingMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const requestIdHeader = request.headers['x-request-id'];
    const requestId =
      (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader) || randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    const startTime = process.hrtime.bigint();
    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
      const path = request.originalUrl || request.url;

      this.metricsService.recordHttpRequest({
        method: request.method,
        path,
        statusCode: response.statusCode,
      });

      console.log(
        JSON.stringify({
          level: 'info',
          message: 'http_request',
          timestamp: new Date().toISOString(),
          requestId,
          method: request.method,
          path,
          statusCode: response.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          userAgent: request.get('user-agent') ?? '',
          ip: request.ip,
        }),
      );
    });

    next();
  }
}

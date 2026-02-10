import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CasesModule } from './cases/cases.module';
import { StructuredLoggingMiddleware } from './common/structured-logging.middleware';

@Module({
  imports: [CasesModule],
  providers: [StructuredLoggingMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StructuredLoggingMiddleware).forRoutes('*');
  }
}

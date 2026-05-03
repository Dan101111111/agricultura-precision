import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TrpcRouter } from './trpc/trpc.router';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] });

  // Mount tRPC router at /trpc
  const trpcRouter = app.get(TrpcRouter);
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: trpcRouter.appRouter,
      createContext: ({ req }: { req: any }) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        return { token };
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
  console.log(`Backend running on http://localhost:${process.env.PORT ?? 3001}`);
}
bootstrap();

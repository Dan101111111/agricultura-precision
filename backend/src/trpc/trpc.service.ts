import { Injectable } from '@nestjs/common';
import { initTRPC, TRPCError } from '@trpc/server';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TrpcService {
  private t = initTRPC.context<{ token?: string; user?: any }>().create();

  constructor(private jwtService: JwtService) {}

  router = this.t.router;
  procedure = this.t.procedure;
  mergeRouters = this.t.mergeRouters;

  authMiddleware() {
    return this.t.middleware(({ ctx, next }) => {
      if (!ctx.token) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const payload = this.jwtService.verify<any>(ctx.token);
        const user = {
          ...payload,
          id: payload?.id ?? payload?.sub,
        };
        if (!user.id) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return next({ ctx: { ...ctx, user } });
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
    });
  }
}

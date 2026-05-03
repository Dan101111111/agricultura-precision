import { Module } from '@nestjs/common';
import { PlotsService } from './plots.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PlotsService],
  exports: [PlotsService],
})
export class PlotsModule {}

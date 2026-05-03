import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { PredictionsService } from './predictions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule, ScheduleModule.forRoot()],
  providers: [PredictionsService],
  exports: [PredictionsService],
})
export class PredictionsModule {}

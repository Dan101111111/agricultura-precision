import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FarmsModule } from './farms/farms.module';
import { PlotsModule } from './plots/plots.module';
import { PredictionsModule } from './predictions/predictions.module';
import { ReportsModule } from './reports/reports.module';
import { SensorsModule } from './sensors/sensors.module';
import { IrrigationModule } from './irrigation/irrigation.module';
import { TrpcModule } from './trpc/trpc.module';
import { AutomationModule } from './automation/automation.module';
@Module({
 imports: [
 PrismaModule,
 AuthModule,
 FarmsModule,
 PlotsModule,
 PredictionsModule,
 ReportsModule,
 SensorsModule,
 IrrigationModule,
 TrpcModule,
 AutomationModule,
 ],
})
export class AppModule {}

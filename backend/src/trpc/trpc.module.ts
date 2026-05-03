import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { TrpcRouter } from './trpc.router';
import { AuthModule } from '../auth/auth.module';
import { FarmsModule } from '../farms/farms.module';
import { PlotsModule } from '../plots/plots.module';
import { PredictionsModule } from '../predictions/predictions.module';
import { ReportsModule } from '../reports/reports.module';
import { SensorsModule } from '../sensors/sensors.module';
import { IrrigationModule } from '../irrigation/irrigation.module';
import { AlertsModule } from '../alerts/alerts.module';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [
    AuthModule,
    FarmsModule,
    PlotsModule,
    PredictionsModule,
    ReportsModule,
    SensorsModule,
    IrrigationModule,
    AlertsModule,
    AutomationModule,
  ],
  providers: [TrpcService, TrpcRouter],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}

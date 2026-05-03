import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SensorsService {
  constructor(private prisma: PrismaService) {}

  async getLatestReadings(loteId?: string, userId?: string) {
    const where = this.buildSensorWhere(userId, loteId);
    const sensors = await this.prisma.sensor.findMany({
      where,
      include: {
        lote: { select: { nombre: true } },
        lecturas: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
      orderBy: { codigo: 'asc' },
    });

    return sensors.map((sensor) => {
      const lectura = sensor.lecturas[0];
      return {
        id: sensor.id,
        codigo: sensor.codigo,
        tipo: sensor.tipo,
        activo: sensor.activo,
        loteId: sensor.loteId,
        lote: sensor.lote ? { nombre: sensor.lote.nombre } : null,
        ultimaLectura: lectura
          ? {
              timestamp: lectura.timestamp,
              temperatura: this.toNumber(lectura.temperatura),
              humedadAmbiente: lectura.humedadAmbiente,
              humedadSuelo: lectura.humedadSuelo,
              precipitacion: this.toNumber(lectura.precipitacion),
              velocidadViento: this.toNumber(lectura.velocidadViento),
              presionAtmosferica: this.toNumber(lectura.presionAtmosferica),
            }
          : null,
      };
    });
  }

  async getOverview(userId?: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const where = this.buildSensorWhere(userId);

    const [activeSensors, totalSensors, readings24h] = await Promise.all([
      this.prisma.sensor.count({
        where: {
          ...where,
          activo: true,
        },
      }),
      this.prisma.sensor.count({ where }),
      this.prisma.lecturaSensor.count({
        where: {
          sensor: where,
          timestamp: { gte: last24h },
        },
      }),
    ]);

    return { activeSensors, totalSensors, readings24h };
  }

  async refreshReadings(loteId?: string, userId?: string) {
    const where = this.buildSensorWhere(userId, loteId);
    const sensors = await this.prisma.sensor.findMany({
      where: {
        ...where,
        activo: true,
      },
      include: {
        lecturas: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    if (sensors.length === 0) {
      return {
        updatedSensors: 0,
        createdReadings: 0,
        generatedAt: new Date().toISOString(),
      };
    }

    const now = new Date();
    const data = sensors.map((sensor) => {
      const previous = sensor.lecturas[0];
      const prevTemp = previous?.temperatura ? Number(previous.temperatura) : 22;
      const prevHumidity = previous?.humedadAmbiente ?? 65;
      const prevSoil = previous?.humedadSuelo ?? 55;
      const prevWind = previous?.velocidadViento ? Number(previous.velocidadViento) : 3;
      const prevPressure = previous?.presionAtmosferica ? Number(previous.presionAtmosferica) : 1012;

      return {
        sensorId: sensor.id,
        timestamp: now,
        temperatura: this.round(this.clamp(prevTemp + this.randomBetween(-1.4, 1.4), 8, 45), 1),
        humedadAmbiente: Math.round(this.clamp(prevHumidity + this.randomBetween(-6, 6), 20, 100)),
        humedadSuelo: Math.round(this.clamp(prevSoil + this.randomBetween(-5, 5), 10, 100)),
        precipitacion: Math.random() < 0.18 ? this.round(this.randomBetween(0, 2.2), 1) : 0,
        velocidadViento: this.round(this.clamp(prevWind + this.randomBetween(-1.2, 1.2), 0, 20), 2),
        presionAtmosferica: this.round(this.clamp(prevPressure + this.randomBetween(-2, 2), 980, 1040), 2),
      };
    });

    const result = await this.prisma.lecturaSensor.createMany({ data });
    return {
      updatedSensors: sensors.length,
      createdReadings: result.count,
      generatedAt: now.toISOString(),
    };
  }

  async createSensor(
    input: {
      codigo: string;
      tipo: string;
      loteId?: string | null;
      activo?: boolean;
      lat?: number;
      lon?: number;
    },
    userId: string,
  ) {
    if (input.loteId) {
      await this.assertUserOwnsPlot(input.loteId, userId);
    }

    const ubicacion = (input.lat !== undefined && input.lon !== undefined)
      ? { lat: input.lat, lon: input.lon }
      : undefined;

    return this.prisma.sensor.create({
      data: {
        codigo: input.codigo.trim(),
        tipo: input.tipo.trim().toLowerCase(),
        loteId: input.loteId ?? null,
        activo: input.activo ?? true,
        ubicacion,
      },
    });
  }

  async assignPlot(sensorId: string, loteId: string | null | undefined, userId: string) {
    const sensor = await this.prisma.sensor.findUnique({
      where: { id: sensorId },
      include: {
        lote: {
          include: {
            finca: true,
          },
        },
      },
    });
    if (!sensor) {
      throw new NotFoundException('Sensor no encontrado');
    }

    if (sensor.lote && sensor.lote.finca.usuarioId !== userId) {
      throw new ForbiddenException('No puedes editar este sensor');
    }

    if (loteId) {
      await this.assertUserOwnsPlot(loteId, userId);
    }

    return this.prisma.sensor.update({
      where: { id: sensorId },
      data: { loteId: loteId ?? null },
    });
  }

  private toNumber(value: unknown) {
    if (value === null || value === undefined) return null;
    return Number(value);
  }

  private async assertUserOwnsPlot(loteId: string, userId: string) {
    const lote = await this.prisma.lote.findFirst({
      where: {
        id: loteId,
        finca: { usuarioId: userId },
      },
      select: { id: true },
    });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }
  }

  private buildSensorWhere(userId?: string, loteId?: string): Prisma.SensorWhereInput | undefined {
    if (loteId) {
      if (userId) {
        return {
          loteId,
          lote: { finca: { usuarioId: userId } },
        };
      }
      return { loteId };
    }
    if (!userId) {
      return undefined;
    }
    return {
      OR: [
        { lote: { finca: { usuarioId: userId } } },
        { loteId: null },
      ],
    };
  }

  private randomBetween(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private round(value: number, decimals: number) {
    return Number(value.toFixed(decimals));
  }
}

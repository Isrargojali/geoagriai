import {
  AUDIT_ACTIONS,
  type AnalysisSummaryDto,
  type CreateFarmInput,
  type FarmDto,
  type FarmGeometry,
  type UpdateFarmInput,
} from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { fromJson, toJson } from '../../lib/json.js';
import { NotFoundError } from '../../lib/errors.js';
import { assertCanCreateFarm } from '../subscriptions/usage.service.js';
import { analyzeGeometry } from './geometry.service.js';

type FarmWithRelations = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.farm.findFirst<{
        where: object;
        include: {
          boundary: true;
          analyses: { orderBy: { createdAt: 'desc' }; take: 1 };
        };
      }>
    >
  >
>;

const farmInclude = {
  boundary: true,
  analyses: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

function toAnalysisSummary(a: FarmWithRelations['analyses'][number]): AnalysisSummaryDto {
  return {
    id: a.id,
    farmId: a.farmId,
    type: a.type as AnalysisSummaryDto['type'],
    status: a.status as AnalysisSummaryDto['status'],
    imageDate: a.imageDate?.toISOString() ?? null,
    cloudCover: a.cloudCover,
    ndviMean: a.ndviMean,
    healthScore: a.healthScore,
    healthStatus: a.healthStatus as AnalysisSummaryDto['healthStatus'],
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  };
}

export function toFarmDto(farm: FarmWithRelations): FarmDto {
  return {
    id: farm.id,
    name: farm.name,
    description: farm.description,
    cropType: farm.cropType,
    plantingDate: farm.plantingDate?.toISOString() ?? null,
    areaHectares: farm.areaHectares,
    centroidLat: farm.centroidLat,
    centroidLng: farm.centroidLng,
    boundary: farm.boundary
      ? {
          id: farm.boundary.id,
          geometry: fromJson<FarmGeometry>(farm.boundary.geometryJson) as FarmGeometry,
          source: farm.boundary.source as 'DRAWN' | 'GEOJSON' | 'KML',
          srid: farm.boundary.srid,
        }
      : null,
    latestAnalysis: farm.analyses[0] ? toAnalysisSummary(farm.analyses[0]) : null,
    createdAt: farm.createdAt.toISOString(),
    updatedAt: farm.updatedAt.toISOString(),
  };
}

export async function listFarms(userId: string): Promise<FarmDto[]> {
  const farms = await prisma.farm.findMany({
    where: { userId },
    include: farmInclude,
    orderBy: { createdAt: 'desc' },
  });
  return farms.map(toFarmDto);
}

export async function getFarm(userId: string, farmId: string): Promise<FarmDto> {
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, userId },
    include: farmInclude,
  });
  if (!farm) throw new NotFoundError('Farm');
  return toFarmDto(farm);
}

export async function createFarm(
  userId: string,
  input: CreateFarmInput,
  source: 'DRAWN' | 'GEOJSON' | 'KML',
  ipAddress?: string,
  role?: string,
): Promise<FarmDto> {
  await assertCanCreateFarm(userId, role);
  const info = analyzeGeometry(input.geometry);

  const farm = await prisma.farm.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      cropType: input.cropType ?? null,
      plantingDate: input.plantingDate ? new Date(input.plantingDate) : null,
      areaHectares: info.areaHectares,
      centroidLat: info.centroidLat,
      centroidLng: info.centroidLng,
      boundary: {
        create: {
          geometryJson: toJson(info.geometry),
          source,
        },
      },
    },
    include: farmInclude,
  });

  await audit({
    userId,
    action: AUDIT_ACTIONS.FARM_CREATED,
    resource: 'farm',
    resourceId: farm.id,
    details: { name: farm.name, areaHectares: farm.areaHectares, source },
    ipAddress,
  });

  return toFarmDto(farm);
}

export async function updateFarm(
  userId: string,
  farmId: string,
  input: UpdateFarmInput,
  ipAddress?: string,
): Promise<FarmDto> {
  const existing = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!existing) throw new NotFoundError('Farm');

  const geometryInfo = input.geometry ? analyzeGeometry(input.geometry) : null;

  const farm = await prisma.farm.update({
    where: { id: farmId },
    data: {
      name: input.name,
      description: input.description,
      cropType: input.cropType,
      plantingDate:
        input.plantingDate === undefined
          ? undefined
          : input.plantingDate === null
            ? null
            : new Date(input.plantingDate),
      ...(geometryInfo
        ? {
            areaHectares: geometryInfo.areaHectares,
            centroidLat: geometryInfo.centroidLat,
            centroidLng: geometryInfo.centroidLng,
            boundary: {
              upsert: {
                create: { geometryJson: toJson(geometryInfo.geometry), source: 'DRAWN' },
                update: { geometryJson: toJson(geometryInfo.geometry), source: 'DRAWN' },
              },
            },
          }
        : {}),
    },
    include: farmInclude,
  });

  await audit({
    userId,
    action: AUDIT_ACTIONS.FARM_UPDATED,
    resource: 'farm',
    resourceId: farm.id,
    details: { geometryChanged: Boolean(geometryInfo) },
    ipAddress,
  });

  return toFarmDto(farm);
}

export async function deleteFarm(
  userId: string,
  farmId: string,
  ipAddress?: string,
): Promise<void> {
  const existing = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!existing) throw new NotFoundError('Farm');

  await prisma.farm.delete({ where: { id: farmId } });
  await audit({
    userId,
    action: AUDIT_ACTIONS.FARM_DELETED,
    resource: 'farm',
    resourceId: farmId,
    details: { name: existing.name },
    ipAddress,
  });
}

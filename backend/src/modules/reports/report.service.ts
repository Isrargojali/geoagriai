import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AUDIT_ACTIONS, type ReportDto } from '@geoagri/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { toFarmDto } from '../farms/farm.service.js';
import { getAnalysis } from '../analyses/analysis.service.js';
import { generateFarmReportPdf } from './report.pdf.js';

type ReportWithFarm = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.report.findFirst<{ where: object; include: { farm: true } }>
    >
  >
>;

function toReportDto(report: ReportWithFarm): ReportDto {
  return {
    id: report.id,
    farmId: report.farmId,
    farmName: report.farm.name,
    analysisId: report.analysisId,
    type: report.type as ReportDto['type'],
    fileName: report.fileName,
    downloadUrl: `/api/v1/reports/${report.id}/download`,
    createdAt: report.createdAt.toISOString(),
  };
}

/** CSV escaping per RFC 4180. */
function csvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function generateCsvReport(userId: string, farmId: string): Promise<{ filePath: string; fileName: string }> {
  const analyses = await prisma.analysis.findMany({
    where: { farmId, userId, status: 'COMPLETED' },
    orderBy: { createdAt: 'asc' },
  });
  if (analyses.length === 0) {
    throw new BadRequestError('This farm has no completed analyses to export');
  }

  const header = [
    'analysis_id',
    'image_date',
    'created_at',
    'cloud_cover_pct',
    'ndvi_mean',
    'ndvi_min',
    'ndvi_max',
    'ndvi_std_dev',
    'health_score',
    'health_status',
  ];
  const rows = analyses.map((a) =>
    [
      a.id,
      a.imageDate?.toISOString().slice(0, 10) ?? '',
      a.createdAt.toISOString(),
      a.cloudCover ?? '',
      a.ndviMean ?? '',
      a.ndviMin ?? '',
      a.ndviMax ?? '',
      a.ndviStdDev ?? '',
      a.healthScore ?? '',
      a.healthStatus ?? '',
    ]
      .map(csvCell)
      .join(','),
  );

  const fileName = `analyses-${farmId}-${Date.now()}.csv`;
  const filePath = path.join(env.reportsDir, fileName);
  await writeFile(filePath, [header.join(','), ...rows].join('\n'), 'utf-8');
  return { filePath, fileName };
}

export async function createReport(
  userId: string,
  farmId: string,
  type: 'PDF' | 'CSV',
  analysisId: string | undefined,
  ipAddress?: string,
): Promise<ReportDto> {
  const farmRecord = await prisma.farm.findFirst({
    where: { id: farmId, userId },
    include: { boundary: true, analyses: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!farmRecord) throw new NotFoundError('Farm');

  let generated: { filePath: string; fileName: string };
  let linkedAnalysisId: string | null = null;

  if (type === 'CSV') {
    generated = await generateCsvReport(userId, farmId);
  } else {
    // PDF: report on a specific analysis, defaulting to the latest completed one.
    const targetAnalysisId =
      analysisId ??
      (
        await prisma.analysis.findFirst({
          where: { farmId, userId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
      )?.id;
    if (!targetAnalysisId) {
      throw new BadRequestError('This farm has no completed analysis to report on');
    }

    const analysis = await getAnalysis(userId, targetAnalysisId);
    if (analysis.farmId !== farmId) {
      throw new BadRequestError('The analysis does not belong to this farm');
    }
    linkedAnalysisId = targetAnalysisId;

    const analysisRecord = await prisma.analysis.findUnique({
      where: { id: targetAnalysisId },
      select: { ndviImagePath: true },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    generated = await generateFarmReportPdf({
      farm: toFarmDto(farmRecord),
      analysis,
      ownerName: `${user.firstName} ${user.lastName}`,
      ndviImageAbsolutePath: analysisRecord?.ndviImagePath ?? null,
    });
  }

  const report = await prisma.report.create({
    data: {
      userId,
      farmId,
      analysisId: linkedAnalysisId,
      type,
      fileName: generated.fileName,
      filePath: generated.filePath,
    },
    include: { farm: true },
  });

  await audit({
    userId,
    action: AUDIT_ACTIONS.REPORT_GENERATED,
    resource: 'report',
    resourceId: report.id,
    details: { farmId, type },
    ipAddress,
  });

  return toReportDto(report);
}

export async function listReports(userId: string): Promise<ReportDto[]> {
  const reports = await prisma.report.findMany({
    where: { userId },
    include: { farm: true },
    orderBy: { createdAt: 'desc' },
  });
  return reports.map(toReportDto);
}

export async function getReportFile(
  userId: string,
  reportId: string,
): Promise<{ filePath: string; fileName: string; contentType: string }> {
  const report = await prisma.report.findFirst({ where: { id: reportId, userId } });
  if (!report) throw new NotFoundError('Report');
  return {
    filePath: report.filePath,
    fileName: report.fileName,
    contentType: report.type === 'PDF' ? 'application/pdf' : 'text/csv',
  };
}

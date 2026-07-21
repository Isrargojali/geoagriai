import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import {
  HEALTH_STATUS_LABELS,
  type AnalysisDto,
  type FarmDto,
  type HealthStatus,
} from '@geoagri/shared';
import { env } from '../../config/env.js';

const BRAND_GREEN = '#166534';
const TEXT_DARK = '#1e293b';
const TEXT_MUTED = '#64748b';

export interface FarmReportData {
  farm: FarmDto;
  analysis: AnalysisDto;
  ownerName: string;
  ndviImageAbsolutePath: string | null;
}

/** Render a crop-health PDF report for one analysis; returns the file path. */
export async function generateFarmReportPdf(data: FarmReportData): Promise<{ filePath: string; fileName: string }> {
  const { farm, analysis } = data;
  const fileName = `report-${farm.id}-${analysis.id}.pdf`;
  const filePath = path.join(env.reportsDir, fileName);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // ---------- Header ----------
  doc.rect(0, 0, doc.page.width, 100).fill(BRAND_GREEN);
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(22).text('GeoAgri AI — Crop Health Report', 50, 30);
  doc.font('Helvetica').fontSize(10).text('Smart Farming from Space', 50, 60);

  let y = 130;

  // ---------- Farm summary ----------
  doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(14).text(farm.name, 50, y);
  y += 22;
  doc.font('Helvetica').fontSize(10).fill(TEXT_MUTED);
  const meta = [
    `Owner: ${data.ownerName}`,
    `Area: ${farm.areaHectares.toFixed(2)} ha`,
    farm.cropType ? `Crop: ${farm.cropType}` : null,
    `Location: ${farm.centroidLat.toFixed(4)}, ${farm.centroidLng.toFixed(4)}`,
    `Report generated: ${new Date().toISOString().slice(0, 10)}`,
    analysis.imageDate ? `Satellite image date: ${analysis.imageDate.slice(0, 10)}` : null,
    analysis.cloudCover != null ? `Scene cloud cover: ${analysis.cloudCover.toFixed(1)}%` : null,
  ].filter(Boolean) as string[];
  for (const line of meta) {
    doc.text(line, 50, y);
    y += 14;
  }
  y += 10;

  // ---------- Health score ----------
  doc.rect(50, y, doc.page.width - 100, 60).fill('#f0fdf4');
  doc.fill(BRAND_GREEN).font('Helvetica-Bold').fontSize(28).text(
    analysis.healthScore != null ? `${analysis.healthScore}/100` : 'N/A',
    70,
    y + 14,
  );
  doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(12).text('Crop Health Score', 200, y + 12);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fill(TEXT_MUTED)
    .text(
      analysis.healthStatus
        ? `Status: ${HEALTH_STATUS_LABELS[analysis.healthStatus as HealthStatus]}`
        : 'Status unavailable',
      200,
      y + 30,
    );
  y += 80;

  // ---------- NDVI statistics ----------
  if (analysis.statistics) {
    const s = analysis.statistics;
    doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(12).text('NDVI Statistics (Sentinel-2)', 50, y);
    y += 20;
    const rows: Array<[string, string]> = [
      ['Mean NDVI', s.mean.toFixed(3)],
      ['Median NDVI', s.median.toFixed(3)],
      ['Minimum', s.min.toFixed(3)],
      ['Maximum', s.max.toFixed(3)],
      ['Std. deviation', s.stdDev.toFixed(3)],
      ['Pixels analyzed', String(s.pixelCount)],
    ];
    doc.font('Helvetica').fontSize(10);
    for (const [label, value] of rows) {
      doc.fill(TEXT_MUTED).text(label, 60, y);
      doc.fill(TEXT_DARK).text(value, 250, y);
      y += 15;
    }
    y += 8;

    doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(12).text('Field Condition Distribution', 50, y);
    y += 20;
    const dist: Array<[string, number, string]> = [
      ['Excellent', s.distribution.excellent, '#15803d'],
      ['Good', s.distribution.good, '#65a30d'],
      ['Moderate', s.distribution.moderate, '#ca8a04'],
      ['Poor', s.distribution.poor, '#ea580c'],
      ['Critical', s.distribution.critical, '#dc2626'],
    ];
    const barMaxWidth = 300;
    for (const [label, fraction, color] of dist) {
      doc.font('Helvetica').fontSize(9).fill(TEXT_MUTED).text(label, 60, y);
      doc.rect(130, y, Math.max(1, fraction * barMaxWidth), 9).fill(color);
      doc.fill(TEXT_DARK).text(`${(fraction * 100).toFixed(1)}%`, 140 + fraction * barMaxWidth, y - 1);
      y += 16;
    }
    y += 10;
  }

  // ---------- NDVI map ----------
  if (data.ndviImageAbsolutePath && existsSync(data.ndviImageAbsolutePath)) {
    if (y > 520) {
      doc.addPage();
      y = 50;
    }
    doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(12).text('NDVI Health Map', 50, y);
    y += 18;
    try {
      doc.image(data.ndviImageAbsolutePath, 50, y, { fit: [300, 220] });
      y += 235;
    } catch {
      doc.font('Helvetica').fontSize(9).fill(TEXT_MUTED).text('Map image could not be embedded.', 50, y);
      y += 20;
    }
  }

  // ---------- Weather ----------
  if (analysis.weather) {
    if (y > 640) {
      doc.addPage();
      y = 50;
    }
    const w = analysis.weather;
    doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(12).text('Weather at Analysis Time', 50, y);
    y += 18;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fill(TEXT_MUTED)
      .text(
        `${w.description} — ${w.temperatureC.toFixed(1)}°C, humidity ${w.humidityPct.toFixed(0)}%, ` +
          `rain ${w.rainfallMm.toFixed(1)} mm, wind ${w.windSpeedKmh.toFixed(0)} km/h`,
        50,
        y,
      );
    y += 26;
  }

  // ---------- AI recommendation ----------
  if (analysis.recommendation) {
    if (y > 560) {
      doc.addPage();
      y = 50;
    }
    const rec = analysis.recommendation;
    doc.fill(TEXT_DARK).font('Helvetica-Bold').fontSize(12).text('AI Recommendation', 50, y);
    y += 18;
    doc.font('Helvetica-Bold').fontSize(10).fill(TEXT_DARK).text(rec.summary, 50, y, {
      width: doc.page.width - 100,
    });
    y = doc.y + 10;

    doc.font('Helvetica-Bold').fontSize(10).fill(TEXT_DARK).text('Recommended actions:', 50, y);
    y = doc.y + 4;
    doc.font('Helvetica').fontSize(10).fill(TEXT_MUTED);
    for (const action of rec.actions) {
      doc.text(`• ${action}`, 60, y, { width: doc.page.width - 120 });
      y = doc.y + 4;
    }
    y += 6;

    doc.font('Helvetica-Bold').fontSize(10).fill(TEXT_DARK).text('Why this recommendation:', 50, y);
    y = doc.y + 4;
    doc.font('Helvetica').fontSize(9).fill(TEXT_MUTED);
    for (const reason of rec.reasons) {
      doc.text(`• ${reason}`, 60, y, { width: doc.page.width - 120 });
      y = doc.y + 4;
    }
  }

  // ---------- Footer ----------
  doc
    .fontSize(8)
    .fill(TEXT_MUTED)
    .text(
      'NDVI is computed from Sentinel-2 surface reflectance via Google Earth Engine. ' +
        'Recommendations are AI-generated interpretations of GIS and weather data and do not replace agronomic advice.',
      50,
      785,
      { align: 'center', width: doc.page.width - 100 },
    );

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return { filePath, fileName };
}

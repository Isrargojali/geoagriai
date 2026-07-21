import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
  BarElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import type { HistoryPoint } from '@/api/hooks';
import { formatDate } from '@/lib/format';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
);

const GRID_COLOR = 'rgba(148, 163, 184, 0.15)';
const TICK_COLOR = '#94a3b8';

/** NDVI mean over time with min/max band. */
export function NdviHistoryChart({ points }: { points: HistoryPoint[] }) {
  const labels = points.map((p) => formatDate(p.date));
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: 'NDVI max',
            data: points.map((p) => p.ndviMax),
            borderColor: 'transparent',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            pointRadius: 0,
            fill: '+1',
            tension: 0.3,
          },
          {
            label: 'NDVI min',
            data: points.map((p) => p.ndviMin),
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: 'Mean NDVI',
            data: points.map((p) => p.ndviMean),
            borderColor: '#16a34a',
            backgroundColor: '#16a34a',
            pointRadius: 3,
            tension: 0.3,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          y: {
            suggestedMin: 0,
            suggestedMax: 1,
            grid: { color: GRID_COLOR },
            ticks: { color: TICK_COLOR },
          },
          x: { grid: { display: false }, ticks: { color: TICK_COLOR, maxRotation: 45 } },
        },
      }}
    />
  );
}

/** 7-day rainfall + temperature forecast chart. */
export function ForecastChart({
  days,
}: {
  days: Array<{ date: string; tempMaxC: number; tempMinC: number; rainfallMm: number }>;
}) {
  return (
    <Bar
      data={{
        labels: days.map((d) => formatDate(d.date)),
        datasets: [
          {
            type: 'bar' as const,
            label: 'Rain (mm)',
            data: days.map((d) => d.rainfallMm),
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            yAxisID: 'rain',
            borderRadius: 4,
          },
          {
            type: 'line' as const,
            label: 'Max °C',
            data: days.map((d) => d.tempMaxC),
            borderColor: '#f97316',
            backgroundColor: '#f97316',
            yAxisID: 'temp',
            tension: 0.3,
          },
          {
            type: 'line' as const,
            label: 'Min °C',
            data: days.map((d) => d.tempMinC),
            borderColor: '#38bdf8',
            backgroundColor: '#38bdf8',
            yAxisID: 'temp',
            tension: 0.3,
          },
        ] as never,
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: TICK_COLOR, boxWidth: 12 } } },
        scales: {
          rain: {
            position: 'left',
            grid: { color: GRID_COLOR },
            ticks: { color: TICK_COLOR },
            title: { display: true, text: 'mm', color: TICK_COLOR },
            beginAtZero: true,
          },
          temp: {
            position: 'right',
            grid: { display: false },
            ticks: { color: TICK_COLOR },
            title: { display: true, text: '°C', color: TICK_COLOR },
          },
          x: { grid: { display: false }, ticks: { color: TICK_COLOR } },
        },
      }}
    />
  );
}

/** Simple daily count line for admin analytics. */
export function CountsChart({
  points,
  label,
  color = '#16a34a',
}: {
  points: Array<{ date: string; count: number }>;
  label: string;
  color?: string;
}) {
  return (
    <Line
      data={{
        labels: points.map((p) => p.date.slice(5)),
        datasets: [
          {
            label,
            data: points.map((p) => p.count),
            borderColor: color,
            backgroundColor: `${color}30`,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: GRID_COLOR }, ticks: { color: TICK_COLOR, precision: 0 } },
          x: { grid: { display: false }, ticks: { color: TICK_COLOR, maxTicksLimit: 10 } },
        },
      }}
    />
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-900 p-10 text-white lg:flex">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_30%_20%,#4ade80_0,transparent_40%),radial-gradient(circle_at_80%_80%,#22d3ee_0,transparent_40%)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🛰️</span>
            <div>
              <div className="text-2xl font-bold">GeoAgri AI</div>
              <div className="text-xs uppercase tracking-[0.3em] text-brand-300">
                Smart Farming from Space
              </div>
            </div>
          </div>
        </div>
        <div className="relative space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Monitor crop health with free satellite imagery
          </h2>
          <ul className="space-y-2 text-sm text-brand-100">
            <li>✦ Sentinel-2 NDVI analysis via Google Earth Engine</li>
            <li>✦ AI recommendations that explain their reasoning</li>
            <li>✦ Weather, forecasts and historical comparison</li>
            <li>✦ PDF & CSV reports for your agronomist</li>
          </ul>
        </div>
        <p className="relative text-xs text-brand-300">
          14-day free trial · no credit card required
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-3xl">🛰️</span>
              <span className="text-xl font-bold text-brand-700 dark:text-brand-400">GeoAgri AI</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

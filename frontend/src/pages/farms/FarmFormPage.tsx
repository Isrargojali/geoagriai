import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { FarmGeometry } from '@geoagri/shared';
import { useCreateFarm, useFarm, useUpdateFarm, useUploadFarm } from '@/api/hooks';
import { DrawMap } from '@/components/map/DrawMap';
import { Alert, Card, PageSpinner, Spinner } from '@/components/ui';

type Mode = 'draw' | 'upload';

export function FarmFormPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const isEdit = Boolean(farmId);
  const navigate = useNavigate();

  const { data: existing, isLoading: loadingExisting } = useFarm(farmId);
  const createFarm = useCreateFarm();
  const uploadFarm = useUploadFarm();
  const updateFarm = useUpdateFarm(farmId ?? '');

  const [mode, setMode] = useState<Mode>('draw');
  const [form, setForm] = useState({ name: '', description: '', cropType: '', plantingDate: '' });
  const [geometry, setGeometry] = useState<FarmGeometry | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        description: existing.description ?? '',
        cropType: existing.cropType ?? '',
        plantingDate: existing.plantingDate ? existing.plantingDate.slice(0, 10) : '',
      });
      setGeometry(existing.boundary?.geometry ?? null);
    }
  }, [existing]);

  const busy = createFarm.isPending || uploadFarm.isPending || updateFarm.isPending;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Farm name is required');
      return;
    }

    try {
      if (isEdit) {
        const updated = await updateFarm.mutateAsync({
          name: form.name,
          description: form.description || null,
          cropType: form.cropType || null,
          plantingDate: form.plantingDate || null,
          ...(geometry ? { geometry } : {}),
        });
        navigate(`/farms/${updated.id}`);
        return;
      }

      if (mode === 'upload') {
        if (!file) {
          setError('Choose a GeoJSON or KML file to upload');
          return;
        }
        const fd = new FormData();
        fd.append('name', form.name);
        if (form.description) fd.append('description', form.description);
        if (form.cropType) fd.append('cropType', form.cropType);
        if (form.plantingDate) fd.append('plantingDate', form.plantingDate);
        fd.append('file', file);
        const farm = await uploadFarm.mutateAsync(fd);
        navigate(`/farms/${farm.id}`);
        return;
      }

      if (!geometry) {
        setError('Draw your farm boundary on the map first');
        return;
      }
      const farm = await createFarm.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        cropType: form.cropType || undefined,
        plantingDate: form.plantingDate || undefined,
        geometry,
      });
      navigate(`/farms/${farm.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving failed');
    }
  };

  if (isEdit && loadingExisting) return <PageSpinner />;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? `Edit ${existing?.name ?? 'farm'}` : 'Create a farm'}</h1>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy && <Spinner className="h-4 w-4" />} {isEdit ? 'Save changes' : 'Create farm'}
          </button>
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Farm details">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Name *</label>
              <input id="name" className="input" required value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="cropType">Crop type</label>
              <input id="cropType" className="input" placeholder="e.g. wheat, cotton, rice" value={form.cropType}
                onChange={(e) => setForm((f) => ({ ...f, cropType: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="plantingDate">Planting date</label>
              <input id="plantingDate" type="date" className="input" value={form.plantingDate}
                onChange={(e) => setForm((f) => ({ ...f, plantingDate: e.target.value }))} />
            </div>
            <div>
              <label className="label" htmlFor="description">Description</label>
              <textarea id="description" className="input" rows={4} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
        </Card>

        <Card
          title="Farm boundary"
          className="lg:col-span-2"
          actions={
            !isEdit && (
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
                {(['draw', 'upload'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-md px-3 py-1 font-medium ${
                      mode === m
                        ? 'bg-brand-700 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {m === 'draw' ? 'Draw on map' : 'Upload file'}
                  </button>
                ))}
              </div>
            )
          }
        >
          {mode === 'draw' || isEdit ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click the polygon icon (top-right of the map, ▲ shape) then click around your
                farm's edges. Click the first point again (or double-click the last point) to
                close the shape. Drawing a new polygon replaces the previous one.
              </p>
              <DrawMap initialGeometry={geometry} onChange={setGeometry} />
              <p className="text-xs text-slate-500">
                {geometry ? '✓ Boundary captured' : 'No boundary drawn yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upload a <strong>.geojson</strong>, <strong>.json</strong> or <strong>.kml</strong>{' '}
                file containing your farm boundary (Polygon or MultiPolygon).
              </p>
              <input
                type="file"
                accept=".geojson,.json,.kml"
                className="input"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && <p className="text-xs text-slate-500">Selected: {file.name}</p>}
            </div>
          )}
        </Card>
      </div>
    </form>
  );
}

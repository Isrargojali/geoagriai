import { useEffect, useState } from 'react';
import { fetchProtectedBlobUrl } from '@/lib/api';
import { Spinner } from './ui';

/** Renders an image that requires an Authorization header to fetch. */
export function AuthImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setError(false);
    fetchProtectedBlobUrl(src)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 ${className ?? ''}`}>
        Image unavailable
      </div>
    );
  }
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className ?? ''}`}>
        <Spinner />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} />;
}

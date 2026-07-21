import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(here, '..');
const testDb = path.resolve(backendDir, '../database/geoagri-test.db');

/** Create a fresh test database with the current schema before the suite runs. */
export default function setup(): void {
  if (existsSync(testDb)) rmSync(testDb);
  execSync('npx prisma db push --skip-generate', {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: 'file:../database/geoagri-test.db' },
    stdio: 'pipe',
  });
}

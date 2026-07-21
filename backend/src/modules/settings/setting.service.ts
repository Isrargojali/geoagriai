import { AUDIT_ACTIONS, type SettingDto } from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { BadRequestError } from '../../lib/errors.js';

type SettingRecord = NonNullable<Awaited<ReturnType<typeof prisma.setting.findFirst>>>;

function toDto(s: SettingRecord): SettingDto {
  return { key: s.key, value: s.value, group: s.group, label: s.label, isPublic: s.isPublic };
}

/** Settings safe to expose to any authenticated user (payment instructions, support contacts). */
export async function getPublicSettings(): Promise<SettingDto[]> {
  const settings = await prisma.setting.findMany({ where: { isPublic: true } });
  return settings.map(toDto);
}

export async function getAllSettings(): Promise<SettingDto[]> {
  const settings = await prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  return settings.map(toDto);
}

export async function getSettingsMap(keys?: string[]): Promise<Record<string, string>> {
  const settings = await prisma.setting.findMany({
    where: keys ? { key: { in: keys } } : undefined,
  });
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

/** Update setting values (admin). Only existing seeded keys can be updated —
 *  the settings catalog itself is code-defined. */
export async function updateSettings(
  adminId: string,
  updates: Array<{ key: string; value: string }>,
  ipAddress?: string,
): Promise<SettingDto[]> {
  const keys = updates.map((u) => u.key);
  const existing = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const existingKeys = new Set(existing.map((s) => s.key));
  const unknown = keys.filter((k) => !existingKeys.has(k));
  if (unknown.length > 0) {
    throw new BadRequestError(`Unknown setting keys: ${unknown.join(', ')}`);
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.setting.update({ where: { key: u.key }, data: { value: u.value } }),
    ),
  );

  await audit({
    userId: adminId,
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    resource: 'settings',
    details: { keys },
    ipAddress,
  });

  return getAllSettings();
}

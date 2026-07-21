import { prisma } from './prisma.js';
import { toJson } from './json.js';

interface AuditEntry {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
}

/**
 * Write an audit log entry. Failures are logged but never break the request —
 * auditing must not take the platform down.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        detailsJson: entry.details === undefined ? null : toJson(entry.details),
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write audit log', err);
  }
}

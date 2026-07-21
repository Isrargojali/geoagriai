import type { NotificationDto } from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';

export async function createNotification(
  userId: string,
  input: { title: string; message: string; type: string },
): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, ...input } });
  } catch (err) {
    // Notifications are best-effort; never fail the main flow.
    console.error('[notifications] failed to create notification', err);
  }
}

export async function listNotifications(
  userId: string,
  unreadOnly: boolean,
): Promise<NotificationDto[]> {
  const items = await prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return items.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type as NotificationDto['type'],
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

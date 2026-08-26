import { Prisma } from '../generated/prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('provides a UUID when inserting a moderation notification', async () => {
    const executeRaw = jest.fn(
      (_query: Prisma.Sql): Promise<number> => Promise.resolve(1),
    );
    const prisma = { $executeRaw: executeRaw };
    const service = new NotificationsService(prisma as never);

    await service.create({
      userId: '11111111-1111-4111-8111-111111111111',
      type: 'DOCUMENT_APPROVED',
      title: 'Approved',
      message: 'Document approved',
      documentId: '22222222-2222-4222-8222-222222222222',
    });

    const query = executeRaw.mock.calls[0][0];
    expect(query.sql).toContain(
      'INSERT INTO "notifications" ("id", "user_id", "type", "title", "message", "document_id")',
    );
    expect(query.values[0]).toEqual(expect.any(String));
    expect(query.values[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

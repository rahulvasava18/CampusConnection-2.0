import { randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import {
  OutboxEventModel,
  type OutboxEventDocument,
  type OutboxEventInput,
  type OutboxEventWriter,
} from './outbox-event.model';

export class MongooseOutboxEventRepository implements OutboxEventWriter {
  public async createPending(
    event: OutboxEventInput,
    session?: ClientSession,
  ): Promise<OutboxEventDocument> {
    const [document] = await OutboxEventModel.create(
      [
        {
          ...event,
          eventVersion: event.eventVersion ?? event.schemaVersion,
          occurredAt: new Date(event.occurredAt),
          status: 'PENDING',
          attempts: 0,
          availableAt: new Date(),
        },
      ],
      { session },
    );
    if (!document) throw new Error('Outbox event creation returned no document');
    return document;
  }

  public async claimBatch(limit: number, leaseMs: number): Promise<OutboxEventDocument[]> {
    const claimed: OutboxEventDocument[] = [];
    for (let index = 0; index < limit; index += 1) {
      const claimId = randomUUID();
      const now = new Date();
      const document = await OutboxEventModel.findOneAndUpdate(
        {
          $or: [
            { status: 'PENDING', availableAt: { $lte: now } },
            {
              status: 'PROCESSING',
              $or: [{ leaseExpiresAt: { $lte: now } }, { leaseExpiresAt: { $exists: false } }],
            },
          ],
        },
        {
          $set: {
            status: 'PROCESSING',
            claimedAt: now,
            claimId,
            leaseExpiresAt: new Date(now.valueOf() + leaseMs),
          },
          $inc: { attempts: 1 },
        },
        { sort: { occurredAt: 1, _id: 1 }, new: true },
      ).exec();
      if (!document) break;
      claimed.push(document);
    }
    return claimed;
  }

  public async markPublished(eventId: string, claimId: string): Promise<void> {
    await OutboxEventModel.updateOne(
      { eventId, status: 'PROCESSING', claimId },
      {
        $set: { status: 'PUBLISHED', publishedAt: new Date() },
        $unset: { claimedAt: 1, claimId: 1, leaseExpiresAt: 1 },
      },
    ).exec();
  }

  public async release(
    eventId: string,
    claimId: string,
    error: string,
    retryAt: Date,
  ): Promise<void> {
    await OutboxEventModel.updateOne(
      { eventId, status: 'PROCESSING', claimId },
      {
        $set: { status: 'PENDING', lastError: error, availableAt: retryAt },
        $unset: { claimedAt: 1, claimId: 1, leaseExpiresAt: 1 },
      },
    ).exec();
  }

  public async fail(eventId: string, claimId: string, error: string): Promise<void> {
    await OutboxEventModel.updateOne(
      { eventId, status: 'PROCESSING', claimId },
      {
        $set: { status: 'FAILED', lastError: error },
        $unset: { claimedAt: 1, claimId: 1, leaseExpiresAt: 1 },
      },
    ).exec();
  }

  public async archivePublished(before: Date, limit = 500): Promise<number> {
    const candidates = await OutboxEventModel.find({
      status: 'PUBLISHED',
      publishedAt: { $lt: before },
    })
      .select('_id')
      .limit(limit)
      .lean()
      .exec();
    if (!candidates.length) return 0;
    const result = await OutboxEventModel.updateMany(
      { _id: { $in: candidates.map((item) => item._id) } },
      { $set: { status: 'ARCHIVED' } },
    ).exec();
    return result.modifiedCount;
  }
}

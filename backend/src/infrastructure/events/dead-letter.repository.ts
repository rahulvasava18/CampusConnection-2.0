import { randomUUID } from 'node:crypto';
import type { EventJobPayload } from '@campusconnection/shared';
import { createQueue } from '../queue/bullmq';
import { DeadLetterModel } from './event-processing.model';

export async function replayDeadLetter(deadLetterId: string): Promise<void> {
  const record = await DeadLetterModel.findOne({ _id: deadLetterId, status: 'OPEN' }).lean().exec();
  if (!record) throw new Error('Open dead-letter record was not found');
  const payload = record.payload as unknown as EventJobPayload;
  if (!payload.eventId || !payload.eventType || !payload.correlationId)
    throw new Error('Dead-letter payload is not a replayable event job');
  await createQueue(record.queue).add(
    'replay',
    { ...payload, causationId: payload.causationId ?? record.eventId },
    { jobId: `replay-${String(record._id)}-${randomUUID()}` },
  );
  await DeadLetterModel.updateOne(
    { _id: record._id, status: 'OPEN' },
    { $set: { status: 'REPLAYED', replayedAt: new Date() } },
  ).exec();
}

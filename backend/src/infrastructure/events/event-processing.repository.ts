import { EventProcessingModel } from './event-processing.model';

export interface ProcessingClaim {
  completed: boolean;
  attempts: number;
}

export async function claimEventProcessing(
  eventId: string,
  consumerName: string,
  eventType: string,
  eventVersion: number,
  correlationId: string,
): Promise<ProcessingClaim> {
  const existing = await EventProcessingModel.findOne({ eventId, consumerName }).lean().exec();
  if (existing?.status === 'COMPLETED') return { completed: true, attempts: existing.attempts };
  const record = await EventProcessingModel.findOneAndUpdate(
    { eventId, consumerName },
    {
      $set: { eventType, eventVersion, correlationId, status: 'PROCESSING', startedAt: new Date() },
      $inc: { attempts: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .lean()
    .exec();
  return { completed: false, attempts: record?.attempts ?? 1 };
}

export async function completeEventProcessing(
  eventId: string,
  consumerName: string,
): Promise<void> {
  await EventProcessingModel.updateOne(
    { eventId, consumerName },
    { $set: { status: 'COMPLETED', completedAt: new Date() }, $unset: { lastError: 1 } },
  ).exec();
}

export async function failEventProcessing(
  eventId: string,
  consumerName: string,
  error: string,
): Promise<void> {
  await EventProcessingModel.updateOne(
    { eventId, consumerName },
    { $set: { status: 'FAILED', lastError: error } },
  ).exec();
}

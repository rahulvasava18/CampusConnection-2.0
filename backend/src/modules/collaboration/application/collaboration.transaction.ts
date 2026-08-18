import mongoose, { type ClientSession } from 'mongoose';
import { discardRecordedEvents, takeRecordedEvents } from '../../../infrastructure/events/domain-event';
import { dispatchCoreEvents } from '../../../infrastructure/events/direct-event-dispatcher';
export async function withMongoTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    await dispatchCoreEvents(takeRecordedEvents(session));
    return result;
  } finally {
    discardRecordedEvents(session);
    await session.endSession();
  }
}

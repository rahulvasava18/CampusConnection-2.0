import { randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import type { EventEnvelope, EventType } from '@campusconnection/shared';
import { MongooseOutboxEventRepository } from './outbox.repository';

export interface PublishEventInput<TPayload extends Record<string, unknown>> {
  eventType: EventType;
  producer: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
}

export class OutboxEventPublisher {
  public constructor(private readonly repository = new MongooseOutboxEventRepository()) {}

  public async record<TPayload extends Record<string, unknown>>(
    input: PublishEventInput<TPayload>,
    session?: ClientSession,
  ) {
    const envelope: EventEnvelope<TPayload> = {
      eventId: randomUUID(),
      eventType: input.eventType,
      eventVersion: 1,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: input.producer,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      correlationId: input.correlationId,
      ...(input.causationId ? { causationId: input.causationId } : {}),
      payload: input.payload,
    };
    return this.repository.createPending(envelope, session);
  }
}

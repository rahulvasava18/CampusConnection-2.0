import { randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import type { EventEnvelope, EventType } from '@campusconnection/shared';

export type DomainEvent = EventEnvelope<Record<string, unknown>>;

const eventsBySession = new WeakMap<object, DomainEvent[]>();

export function takeRecordedEvents(session: ClientSession): DomainEvent[] {
  const events = eventsBySession.get(session) ?? [];
  eventsBySession.delete(session);
  return events;
}

export function discardRecordedEvents(session: ClientSession): void {
  eventsBySession.delete(session);
}

export interface RecordEventInput<TPayload extends Record<string, unknown>> {
  eventType: EventType;
  producer: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
}

export class DomainEventRecorder {
  public record<TPayload extends Record<string, unknown>>(
    input: RecordEventInput<TPayload>,
    session?: ClientSession,
  ): DomainEvent {
    const event: DomainEvent = {
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
    if (session) {
      const events = eventsBySession.get(session) ?? [];
      events.push(event);
      eventsBySession.set(session, events);
    }
    return event;
  }
}

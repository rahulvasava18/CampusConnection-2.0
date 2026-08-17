import { Schema, model, type ClientSession, type Document, type Model } from 'mongoose';
import type { EventEnvelope, EventType } from '@campusconnection/shared';

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'ARCHIVED';

export interface OutboxEventDocument extends Document {
  eventId: string;
  eventType: EventType;
  eventVersion: number;
  schemaVersion: number;
  occurredAt: Date;
  producer: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string;
  correlationId: string;
  causationId?: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  claimedAt?: Date;
  claimId?: string;
  leaseExpiresAt?: Date;
  availableAt: Date;
  publishedAt?: Date;
  lastError?: string;
}

const outboxEventSchema = new Schema<OutboxEventDocument>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    eventVersion: { type: Number, required: true, default: 1 },
    schemaVersion: { type: Number, required: true },
    occurredAt: { type: Date, required: true },
    producer: { type: String, required: true },
    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true, index: true },
    actorId: { type: String },
    correlationId: { type: String, required: true, index: true },
    causationId: { type: String },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'ARCHIVED'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, required: true, default: 0 },
    claimedAt: { type: Date },
    claimId: { type: String, index: true },
    leaseExpiresAt: { type: Date, index: true },
    availableAt: { type: Date, required: true, default: Date.now, index: true },
    publishedAt: { type: Date },
    lastError: { type: String },
  },
  { collection: 'outbox_events', timestamps: true },
);

outboxEventSchema.index({ status: 1, availableAt: 1 });
outboxEventSchema.index({ status: 1, leaseExpiresAt: 1 });

export const OutboxEventModel: Model<OutboxEventDocument> = model<OutboxEventDocument>(
  'OutboxEvent',
  outboxEventSchema,
);

export type OutboxEventInput = EventEnvelope<Record<string, unknown>>;

export interface OutboxEventWriter {
  createPending(event: OutboxEventInput, session?: ClientSession): Promise<OutboxEventDocument>;
}

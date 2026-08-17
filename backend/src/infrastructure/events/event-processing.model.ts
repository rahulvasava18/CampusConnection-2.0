import { Schema, model, type Document, type Model } from 'mongoose';

export type ProcessingStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface EventProcessingDocument extends Document {
  eventId: string;
  consumerName: string;
  eventType: string;
  eventVersion: number;
  correlationId: string;
  status: ProcessingStatus;
  attempts: number;
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
}

const eventProcessingSchema = new Schema<EventProcessingDocument>(
  {
    eventId: { type: String, required: true },
    consumerName: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    eventVersion: { type: Number, required: true },
    correlationId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
      required: true,
      default: 'PROCESSING',
      index: true,
    },
    attempts: { type: Number, required: true, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    lastError: { type: String },
  },
  { collection: 'event_processing', timestamps: true },
);

eventProcessingSchema.index({ eventId: 1, consumerName: 1 }, { unique: true });
eventProcessingSchema.index({ status: 1, createdAt: 1 });

export const EventProcessingModel: Model<EventProcessingDocument> = model<EventProcessingDocument>(
  'EventProcessing',
  eventProcessingSchema,
);

export interface DeadLetterDocument extends Document {
  jobId: string;
  queue: string;
  eventId?: string;
  eventType?: string;
  correlationId?: string;
  attempts: number;
  status: 'OPEN' | 'REPLAYED' | 'RESOLVED';
  payload: Record<string, unknown>;
  lastError: string;
  failedAt: Date;
  replayedAt?: Date;
}

const deadLetterSchema = new Schema<DeadLetterDocument>(
  {
    jobId: { type: String, required: true },
    queue: { type: String, required: true, index: true },
    eventId: { type: String, index: true },
    eventType: { type: String, index: true },
    correlationId: { type: String, index: true },
    attempts: { type: Number, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'REPLAYED', 'RESOLVED'],
      required: true,
      default: 'OPEN',
      index: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    lastError: { type: String, required: true },
    failedAt: { type: Date, required: true },
    replayedAt: { type: Date },
  },
  { collection: 'dead_letter_jobs', timestamps: true },
);

deadLetterSchema.index({ status: 1, failedAt: -1 });
deadLetterSchema.index({ eventId: 1, queue: 1 });

export const DeadLetterModel: Model<DeadLetterDocument> = model<DeadLetterDocument>(
  'DeadLetterJob',
  deadLetterSchema,
);

import { Schema, model, type Document, type Model } from 'mongoose';

export interface NotificationDocument extends Document {
  recipientId: string;
  sourceEventId: string;
  actorId?: string;
  type: string;
  title: string;
  body?: string;
  aggregateType: string;
  aggregateId: string;
  metadata?: Record<string, string | number | boolean>;
  readAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    recipientId: { type: String, required: true, index: true },
    sourceEventId: { type: String, required: true },
    actorId: { type: String, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 500 },
    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    readAt: { type: Date },
    expiresAt: { type: Date },
  },
  { collection: 'notifications', timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ sourceEventId: 1, recipientId: 1 }, { unique: true });
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const NotificationModel: Model<NotificationDocument> = model<NotificationDocument>(
  'Notification',
  notificationSchema,
);

export interface AnalyticsEventDocument extends Document {
  sourceEventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  occurredAt: Date;
  payloadSummary: Record<string, unknown>;
}

const analyticsEventSchema = new Schema<AnalyticsEventDocument>(
  {
    sourceEventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true, index: true },
    eventVersion: { type: Number, required: true },
    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true, index: true },
    correlationId: { type: String, required: true, index: true },
    occurredAt: { type: Date, required: true },
    payloadSummary: { type: Schema.Types.Mixed, required: true },
  },
  { collection: 'analytics_events', timestamps: true },
);

export const AnalyticsEventModel: Model<AnalyticsEventDocument> = model<AnalyticsEventDocument>(
  'AnalyticsEvent',
  analyticsEventSchema,
);

export interface SearchIndexOperationDocument extends Document {
  sourceEventId: string;
  entityType: string;
  entityId: string;
  operation: 'UPSERT' | 'DELETE';
  status: 'COMPLETED';
  processedAt: Date;
}

const searchIndexOperationSchema = new Schema<SearchIndexOperationDocument>(
  {
    sourceEventId: { type: String, required: true, unique: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    operation: { type: String, enum: ['UPSERT', 'DELETE'], required: true },
    status: { type: String, enum: ['COMPLETED'], required: true, default: 'COMPLETED' },
    processedAt: { type: Date, required: true },
  },
  { collection: 'search_index_operations', timestamps: true },
);

export const SearchIndexOperationModel: Model<SearchIndexOperationDocument> =
  model<SearchIndexOperationDocument>('SearchIndexOperation', searchIndexOperationSchema);

export interface DerivedWorkDocument extends Document {
  sourceEventId: string;
  consumer: 'FEED' | 'RECOMMENDATION';
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  processedAt: Date;
}

const derivedWorkSchema = new Schema<DerivedWorkDocument>(
  {
    sourceEventId: { type: String, required: true },
    consumer: { type: String, enum: ['FEED', 'RECOMMENDATION'], required: true },
    eventType: { type: String, required: true },
    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true },
    processedAt: { type: Date, required: true },
  },
  { collection: 'derived_work', timestamps: true },
);

derivedWorkSchema.index({ sourceEventId: 1, consumer: 1 }, { unique: true });

export const DerivedWorkModel: Model<DerivedWorkDocument> = model<DerivedWorkDocument>(
  'DerivedWork',
  derivedWorkSchema,
);

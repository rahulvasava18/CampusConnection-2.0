import { Schema, model, type Document, type Model } from 'mongoose';

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

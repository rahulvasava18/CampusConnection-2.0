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

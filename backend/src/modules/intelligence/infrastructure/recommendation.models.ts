import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import type {
  RecommendationReasonCode,
  RecommendationType,
  AlgorithmVersion,
} from '@campusconnection/shared';

export interface RecommendationSnapshotDocument extends Document {
  userId: Types.ObjectId;
  recommendationType: RecommendationType;
  candidateId: Types.ObjectId;
  score: number;
  reasonCodes: RecommendationReasonCode[];
  rank: number;
  featureVersion: string;
  algorithmVersion: AlgorithmVersion;
  generatedAt: Date;
  expiresAt: Date;
}

const recommendationSnapshotSchema = new Schema<RecommendationSnapshotDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    recommendationType: {
      type: String,
      enum: ['PEOPLE', 'TEAMS', 'PROJECTS', 'COMMUNITIES'],
      required: true,
    },
    candidateId: { type: Schema.Types.ObjectId, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    reasonCodes: { type: [String], default: [] },
    rank: { type: Number, required: true, min: 0 },
    featureVersion: { type: String, required: true },
    algorithmVersion: { type: String, enum: ['recommendation-v1'], required: true },
    generatedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'recommendation_snapshots', timestamps: true },
);

recommendationSnapshotSchema.index({ userId: 1, recommendationType: 1, rank: 1 });
recommendationSnapshotSchema.index({ userId: 1, recommendationType: 1, expiresAt: 1 });
recommendationSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
recommendationSnapshotSchema.index(
  { userId: 1, recommendationType: 1, candidateId: 1, algorithmVersion: 1 },
  { unique: true },
);

export const RecommendationSnapshotModel: Model<RecommendationSnapshotDocument> =
  model<RecommendationSnapshotDocument>('RecommendationSnapshot', recommendationSnapshotSchema);

export interface RecommendationSignalDocument extends Document {
  sourceEventId: string;
  userId: Types.ObjectId;
  signalType: string;
  targetId?: Types.ObjectId;
  value: number;
  occurredAt: Date;
}

const recommendationSignalSchema = new Schema<RecommendationSignalDocument>(
  {
    sourceEventId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    signalType: { type: String, required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, index: true },
    value: { type: Number, required: true },
    occurredAt: { type: Date, required: true },
  },
  { collection: 'recommendation_signals', timestamps: true },
);

recommendationSignalSchema.index({ userId: 1, signalType: 1, occurredAt: -1 });

export const RecommendationSignalModel: Model<RecommendationSignalDocument> =
  model<RecommendationSignalDocument>('RecommendationSignal', recommendationSignalSchema);

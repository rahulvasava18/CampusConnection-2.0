import { Schema, model, type Document, type Model } from 'mongoose';

export type MediaAssetStatus = 'ATTACHED' | 'ORPHANED';

export interface MediaAssetDocument extends Document {
  ownerId: string;
  url: string;
  publicId: string;
  type: string;
  width?: number;
  height?: number;
  bytes?: number;
  status: MediaAssetStatus;
  postId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const mediaAssetSchema = new Schema<MediaAssetDocument>(
  {
    ownerId: { type: String, required: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    width: Number,
    height: Number,
    bytes: Number,
    status: { type: String, enum: ['ATTACHED', 'ORPHANED'], default: 'ATTACHED', index: true },
    postId: { type: String, index: true },
  },
  { collection: 'media_assets', timestamps: true },
);

mediaAssetSchema.index({ ownerId: 1, createdAt: -1 });
mediaAssetSchema.index({ postId: 1, status: 1 });

export const MediaAssetModel: Model<MediaAssetDocument> = model<MediaAssetDocument>(
  'MediaAsset',
  mediaAssetSchema,
);

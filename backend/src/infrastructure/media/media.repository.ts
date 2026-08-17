import type { ClientSession } from 'mongoose';
import { MediaAssetModel, type MediaAssetDocument } from './media.models';
import type { UploadedMedia } from './media-storage';

export class MediaAssetRepository {
  async create(
    input: UploadedMedia & { ownerId: string; postId: string },
    session?: ClientSession,
  ): Promise<MediaAssetDocument> {
    const [asset] = await MediaAssetModel.create([input], { session });
    if (!asset) throw new Error('Media asset creation returned no document');
    return asset;
  }

  listByIds(ids: string[], session?: ClientSession) {
    return MediaAssetModel.find({ _id: { $in: ids }, status: 'ATTACHED' })
      .session(session ?? null)
      .sort({ createdAt: 1 })
      .exec();
  }

  markOrphanedByPost(postId: string, session?: ClientSession) {
    const filter = { postId, status: 'ATTACHED' };
    const update = { $set: { status: 'ORPHANED' } };
    return session
      ? MediaAssetModel.updateMany(filter, update, { session }).exec()
      : MediaAssetModel.updateMany(filter, update).exec();
  }
}

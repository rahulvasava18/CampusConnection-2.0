import { createHash } from 'node:crypto';
import type { Express } from 'express';
import { getEnv } from '../../config/env';
import { AppError } from '../../shared/errors/app-error';

export type UploadedMedia = {
  url: string;
  publicId: string;
  type: string;
  width?: number;
  height?: number;
  bytes?: number;
};

function signature(parameters: Record<string, string>, secret: string): string {
  const payload = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return createHash('sha1').update(`${payload}${secret}`).digest('hex');
}

export interface MediaStorage {
  uploadImage(file: Express.Multer.File, folder?: string): Promise<UploadedMedia>;
  deleteImage(publicId: string): Promise<void>;
}

export class CloudinaryMediaStorage implements MediaStorage {
  private configuration() {
    const env = getEnv();
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new AppError(
        'MEDIA_NOT_CONFIGURED',
        'Image uploads are not configured on this server.',
        503,
      );
    }
    return {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    };
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'campusconnection/posts',
  ): Promise<UploadedMedia> {
    const configuration = this.configuration();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const parameters = { folder, timestamp };
    const form = new FormData();
    const fileBytes = new Uint8Array(file.buffer.byteLength);
    fileBytes.set(file.buffer);
    form.append('file', new Blob([fileBytes.buffer], { type: file.mimetype }), file.originalname);
    form.append('api_key', configuration.apiKey);
    form.append('timestamp', timestamp);
    form.append('folder', folder);
    form.append('signature', signature(parameters, configuration.apiSecret));

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${configuration.cloudName}/image/upload`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new AppError('MEDIA_UPLOAD_FAILED', 'Image upload failed. Please try again.', 502);
    }
    const payload = (await response.json()) as {
      secure_url?: string;
      public_id?: string;
      format?: string;
      width?: number;
      height?: number;
      bytes?: number;
    };
    if (!payload.secure_url || !payload.public_id || !payload.format) {
      throw new AppError('MEDIA_UPLOAD_FAILED', 'Image upload returned incomplete metadata.', 502);
    }
    return {
      url: payload.secure_url,
      publicId: payload.public_id,
      type: `image/${payload.format}`,
      ...(typeof payload.width === 'number' ? { width: payload.width } : {}),
      ...(typeof payload.height === 'number' ? { height: payload.height } : {}),
      ...(typeof payload.bytes === 'number' ? { bytes: payload.bytes } : {}),
    };
  }

  async deleteImage(publicId: string): Promise<void> {
    const configuration = this.configuration();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const parameters = { public_id: publicId, timestamp };
    const form = new URLSearchParams({
      public_id: publicId,
      timestamp,
      api_key: configuration.apiKey,
      signature: signature(parameters, configuration.apiSecret),
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${configuration.cloudName}/image/destroy`,
      {
      method: 'POST',
      body: form,
      },
    );
    if (!response.ok) {
      throw new AppError('MEDIA_DELETE_FAILED', 'Image cleanup failed.', 502);
    }
  }
}

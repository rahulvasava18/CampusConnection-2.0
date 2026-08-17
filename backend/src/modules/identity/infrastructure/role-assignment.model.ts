import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import type { PlatformRole } from '@campusconnection/shared';

export type ScopeType = 'PLATFORM' | 'COLLEGE' | 'COMMUNITY' | 'TEAM' | 'PROJECT';

export interface RoleAssignmentDocument extends Document {
  userId: Types.ObjectId;
  role: PlatformRole;
  scopeType: ScopeType;
  scopeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const roleAssignmentSchema = new Schema<RoleAssignmentDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: [
        'STUDENT',
        'COMMUNITY_ADMIN',
        'COMMUNITY_MODERATOR',
        'CLUB_ORG_ADMIN',
        'MENTOR',
        'COLLEGE_ADMIN',
        'PLATFORM_ADMIN',
      ],
      required: true,
    },
    scopeType: {
      type: String,
      enum: ['PLATFORM', 'COLLEGE', 'COMMUNITY', 'TEAM', 'PROJECT'],
      required: true,
    },
    scopeId: { type: String, index: true },
  },
  { collection: 'role_assignments', timestamps: true },
);

roleAssignmentSchema.index({ userId: 1, role: 1, scopeType: 1, scopeId: 1 }, { unique: true });

export const RoleAssignmentModel: Model<RoleAssignmentDocument> = model<RoleAssignmentDocument>(
  'RoleAssignment',
  roleAssignmentSchema,
);

import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import type {
  ClubInvitationStatus,
  ClubJoinRequestStatus,
  ClubMembershipRole,
  ClubMembershipStatus,
  ClubPrivacy,
  ClubStatus,
} from '@campusconnection/shared';

const objectId = Schema.Types.ObjectId;

export interface ClubDocument extends Document {
  name: string;
  slug: string;
  shortDescription?: string;
  description: string;
  category: string;
  tags: string[];
  logoUrl?: string;
  bannerUrl?: string;
  collegeId?: string;
  contactEmail: string;
  website?: string;
  socialLinks?: Record<string, string>;
  privacy: ClubPrivacy;
  status: ClubStatus;
  ownerId: Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const clubSchema = new Schema<ClubDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 90 },
    shortDescription: { type: String, trim: true, maxlength: 300 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    tags: { type: [String], default: [], maxlength: 20 },
    logoUrl: { type: String, trim: true, maxlength: 500 },
    bannerUrl: { type: String, trim: true, maxlength: 500 },
    collegeId: { type: String, trim: true, maxlength: 120 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    website: { type: String, trim: true, maxlength: 500 },
    socialLinks: { type: Schema.Types.Mixed },
    privacy: { type: String, enum: ['PUBLIC', 'PRIVATE'], required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED'],
      default: 'PENDING',
      index: true,
    },
    ownerId: { type: objectId, required: true, index: true },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  { collection: 'clubs', timestamps: true },
);
clubSchema.index({ name: 1, status: 1 });
clubSchema.index({ category: 1, privacy: 1, status: 1, createdAt: -1 });
export const ClubModel: Model<ClubDocument> = model<ClubDocument>('Club', clubSchema);

export interface ClubMembershipDocument extends Document {
  clubId: Types.ObjectId;
  userId: Types.ObjectId;
  role: ClubMembershipRole;
  status: ClubMembershipStatus;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const clubMembershipSchema = new Schema<ClubMembershipDocument>(
  {
    clubId: { type: objectId, required: true, index: true },
    userId: { type: objectId, required: true, index: true },
    role: { type: String, enum: ['OWNER', 'SECRETARY', 'MEMBER'], required: true },
    status: { type: String, enum: ['ACTIVE', 'LEFT', 'REMOVED'], required: true, default: 'ACTIVE' },
    joinedAt: Date,
  },
  { collection: 'club_memberships', timestamps: true },
);
clubMembershipSchema.index({ clubId: 1, userId: 1 }, { unique: true });
clubMembershipSchema.index({ clubId: 1, status: 1, role: 1 });
export const ClubMembershipModel: Model<ClubMembershipDocument> = model<ClubMembershipDocument>(
  'ClubMembership',
  clubMembershipSchema,
);

export interface ClubJoinRequestDocument extends Document {
  clubId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ClubJoinRequestStatus;
  message?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const clubJoinRequestSchema = new Schema<ClubJoinRequestDocument>(
  {
    clubId: { type: objectId, required: true, index: true },
    userId: { type: objectId, required: true, index: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], required: true },
    message: { type: String, trim: true, maxlength: 500 },
    reviewedBy: objectId,
    reviewedAt: Date,
  },
  { collection: 'club_join_requests', timestamps: true },
);
clubJoinRequestSchema.index({ clubId: 1, userId: 1, status: 1 });
export const ClubJoinRequestModel = model<ClubJoinRequestDocument>(
  'ClubJoinRequest',
  clubJoinRequestSchema,
);

export interface ClubInvitationDocument extends Document {
  clubId: Types.ObjectId;
  inviterId: Types.ObjectId;
  inviteeId: Types.ObjectId;
  status: ClubInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}
const clubInvitationSchema = new Schema<ClubInvitationDocument>(
  {
    clubId: { type: objectId, required: true, index: true },
    inviterId: { type: objectId, required: true },
    inviteeId: { type: objectId, required: true, index: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'], required: true },
  },
  { collection: 'club_invitations', timestamps: true },
);
clubInvitationSchema.index({ clubId: 1, inviteeId: 1, status: 1 });
export const ClubInvitationModel = model<ClubInvitationDocument>(
  'ClubInvitation',
  clubInvitationSchema,
);

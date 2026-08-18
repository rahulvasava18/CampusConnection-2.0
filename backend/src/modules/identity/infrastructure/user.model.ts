import { Schema, model, type Document, type Model } from 'mongoose';
import type {
  AccountState,
  PlatformRole,
  UserPreferences,
  VerificationStatus,
} from '@campusconnection/shared';

export interface UserDocument extends Document {
  username: string;
  usernameNormalized?: string;
  email: string;
  emailNormalized?: string;
  googleId?: string;
  displayName: string;
  passwordHash?: string;
  bio?: string;
  college?: string;
  department?: string;
  course?: string;
  graduationYear?: number;
  skills: string[];
  interests: string[];
  goals: string[];
  avatarUrl?: string;
  accountState: AccountState;
  verificationStatus: VerificationStatus;
  roles: PlatformRole[];
  preferences?: UserPreferences;
  deactivatedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 32,
    },
    usernameNormalized: { type: String, unique: true, lowercase: true, index: true, sparse: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    emailNormalized: { type: String, unique: true, lowercase: true, index: true, sparse: true },
    googleId: { type: String, unique: true, sparse: true, index: true },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    passwordHash: { type: String, select: false },
    bio: { type: String, trim: true, maxlength: 500 },
    college: { type: String, trim: true, maxlength: 160 },
    department: { type: String, trim: true, maxlength: 160 },
    course: { type: String, trim: true, maxlength: 160 },
    graduationYear: { type: Number, min: 1900, max: 2200 },
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    goals: { type: [String], default: [] },
    avatarUrl: { type: String, trim: true, maxlength: 500 },
    accountState: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'BANNED', 'DELETED'],
      default: 'PENDING_VERIFICATION',
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ['UNVERIFIED', 'VERIFIED'],
      default: 'UNVERIFIED',
      index: true,
    },
    roles: {
      type: [String],
      enum: [
        'STUDENT',
        'COMMUNITY_ADMIN',
        'COMMUNITY_MODERATOR',
        'CLUB_ORG_ADMIN',
        'MENTOR',
        'COLLEGE_ADMIN',
        'PLATFORM_ADMIN',
      ],
      default: ['STUDENT'],
    },
    preferences: {
      notifications: {
        messages: { type: Boolean, default: true },
        teamActivity: { type: Boolean, default: true },
        projectActivity: { type: Boolean, default: true },
        communityActivity: { type: Boolean, default: true },
        eventUpdates: { type: Boolean, default: true },
        socialInteractions: { type: Boolean, default: true },
      },
      privacy: {
        profileDiscoverable: { type: Boolean, default: true },
        showInRecommendations: { type: Boolean, default: true },
      },
    },
    deactivatedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { collection: 'users', timestamps: true },
);

export const UserModel: Model<UserDocument> = model<UserDocument>('User', userSchema);

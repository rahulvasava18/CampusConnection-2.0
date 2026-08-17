import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import type {
  CommunityMemberRole,
  CommunityMemberStatus,
  CommunityJoinRequestStatus,
  CommunityInvitationStatus,
  CommunityBanStatus,
  CommunityReportStatus,
  CommunityPrivacy,
  CommunityStatus,
  DiscussionStatus,
  DiscussionType,
  EventMode,
  EventRegistrationStatus,
  EventStatus,
  EventVisibility,
  MilestoneStatus,
  ProjectMemberRole,
  ProjectMemberStatus,
  ProjectJoinRequestStatus,
  ProjectInvitationStatus,
  ProjectResourceType,
  ProjectStatus,
  ProjectVisibility,
  TaskPriority,
  TaskStatus,
  TeamInvitationStatus,
  TeamJoinRequestStatus,
  TeamMemberRole,
  TeamMemberStatus,
  TeamStatus,
  TeamVisibility,
} from '@campusconnection/shared';

const objectId = Schema.Types.ObjectId;
export interface CommunityDocument extends Document {
  name: string;
  slug: string;
  description: string;
  avatarUrl?: string;
  bannerUrl?: string;
  category: string;
  tags: string[];
  rules: string[];
  memberCount: number;
  collegeId?: string;
  privacy: CommunityPrivacy;
  status: CommunityStatus;
  ownerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const communitySchema = new Schema<CommunityDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 80,
    },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    avatarUrl: String,
    bannerUrl: String,
    category: { type: String, required: true, trim: true, maxlength: 80 },
    tags: { type: [String], default: [], maxlength: 20 },
    rules: { type: [String], default: [], maxlength: 20 },
    memberCount: { type: Number, default: 1, min: 0 },
    collegeId: { type: String, trim: true, maxlength: 120 },
    privacy: { type: String, enum: ['PUBLIC', 'CAMPUS', 'PRIVATE'], required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'DELETED'],
      default: 'ACTIVE',
      index: true,
    },
    ownerId: { type: objectId, required: true, index: true },
  },
  { collection: 'communities', timestamps: true },
);
communitySchema.index({ collegeId: 1, status: 1 });
communitySchema.index({ privacy: 1, status: 1, createdAt: -1, _id: -1 });
export const CommunityModel: Model<CommunityDocument> = model<CommunityDocument>(
  'Community',
  communitySchema,
);

export interface CommunityMemberDocument extends Document {
  communityId: Types.ObjectId;
  userId: Types.ObjectId;
  role: CommunityMemberRole;
  status: CommunityMemberStatus;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const communityMemberSchema = new Schema<CommunityMemberDocument>(
  {
    communityId: { type: objectId, required: true },
    userId: { type: objectId, required: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'], required: true },
    status: { type: String, enum: ['ACTIVE', 'PENDING', 'BANNED', 'LEFT'], required: true },
    joinedAt: Date,
  },
  { collection: 'community_members', timestamps: true },
);
communityMemberSchema.index({ communityId: 1, userId: 1 }, { unique: true });
communityMemberSchema.index({ userId: 1, status: 1 });
communityMemberSchema.index({ communityId: 1, status: 1, role: 1 });
export const CommunityMemberModel: Model<CommunityMemberDocument> = model<CommunityMemberDocument>(
  'CommunityMember',
  communityMemberSchema,
);

export interface CommunityJoinRequestDocument extends Document {
  communityId: Types.ObjectId;
  userId: Types.ObjectId;
  status: CommunityJoinRequestStatus;
  message?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const communityJoinRequestSchema = new Schema<CommunityJoinRequestDocument>(
  {
    communityId: { type: objectId, required: true, index: true },
    userId: { type: objectId, required: true, index: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], required: true },
    message: { type: String, trim: true, maxlength: 500 },
    reviewedBy: objectId,
    reviewedAt: Date,
  },
  { collection: 'community_join_requests', timestamps: true },
);
communityJoinRequestSchema.index({ communityId: 1, userId: 1, status: 1 });
communityJoinRequestSchema.index({ communityId: 1, status: 1, createdAt: -1 });
export const CommunityJoinRequestModel: Model<CommunityJoinRequestDocument> =
  model<CommunityJoinRequestDocument>('CommunityJoinRequest', communityJoinRequestSchema);

export interface CommunityInvitationDocument extends Document {
  communityId: Types.ObjectId;
  inviterId: Types.ObjectId;
  inviteeId: Types.ObjectId;
  status: CommunityInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}
const communityInvitationSchema = new Schema<CommunityInvitationDocument>(
  {
    communityId: { type: objectId, required: true, index: true },
    inviterId: { type: objectId, required: true },
    inviteeId: { type: objectId, required: true, index: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'], required: true },
  },
  { collection: 'community_invitations', timestamps: true },
);
communityInvitationSchema.index({ communityId: 1, inviteeId: 1, status: 1 });
export const CommunityInvitationModel: Model<CommunityInvitationDocument> =
  model<CommunityInvitationDocument>('CommunityInvitation', communityInvitationSchema);

export interface CommunityBanDocument extends Document {
  communityId: Types.ObjectId;
  userId: Types.ObjectId;
  bannedBy: Types.ObjectId;
  reason?: string;
  expiresAt?: Date;
  status: CommunityBanStatus;
  createdAt: Date;
  updatedAt: Date;
}
const communityBanSchema = new Schema<CommunityBanDocument>(
  {
    communityId: { type: objectId, required: true, index: true },
    userId: { type: objectId, required: true, index: true },
    bannedBy: { type: objectId, required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    expiresAt: Date,
    status: { type: String, enum: ['ACTIVE', 'REVOKED'], required: true, default: 'ACTIVE' },
  },
  { collection: 'community_bans', timestamps: true },
);
communityBanSchema.index({ communityId: 1, userId: 1, status: 1 });
export const CommunityBanModel: Model<CommunityBanDocument> = model<CommunityBanDocument>(
  'CommunityBan',
  communityBanSchema,
);

export interface CommunityReportDocument extends Document {
  communityId: Types.ObjectId;
  reporterId: Types.ObjectId;
  targetType: 'POST' | 'COMMENT' | 'MEMBER';
  targetId: Types.ObjectId;
  reason: string;
  status: CommunityReportStatus;
  reviewedBy?: Types.ObjectId;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}
const communityReportSchema = new Schema<CommunityReportDocument>(
  {
    communityId: { type: objectId, required: true, index: true },
    reporterId: { type: objectId, required: true },
    targetType: { type: String, enum: ['POST', 'COMMENT', 'MEMBER'], required: true },
    targetId: { type: objectId, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ['OPEN', 'RESOLVED', 'DISMISSED'], default: 'OPEN', index: true },
    reviewedBy: objectId,
    resolution: { type: String, trim: true, maxlength: 500 },
  },
  { collection: 'community_reports', timestamps: true },
);
communityReportSchema.index({ communityId: 1, status: 1, createdAt: -1 });
export const CommunityReportModel: Model<CommunityReportDocument> = model<CommunityReportDocument>(
  'CommunityReport',
  communityReportSchema,
);

export interface DiscussionDocument extends Document {
  communityId: Types.ObjectId;
  authorId: Types.ObjectId;
  title: string;
  content: string;
  type: DiscussionType;
  tags: string[];
  replyCount: number;
  status: DiscussionStatus;
  createdAt: Date;
  updatedAt: Date;
}
const discussionSchema = new Schema<DiscussionDocument>(
  {
    communityId: { type: objectId, required: true },
    authorId: { type: objectId, required: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 10000 },
    type: { type: String, enum: ['QUESTION', 'DISCUSSION', 'RESOURCE'], required: true },
    tags: { type: [String], default: [], maxlength: 10 },
    replyCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['ACTIVE', 'DELETED'], default: 'ACTIVE', index: true },
  },
  { collection: 'community_discussions', timestamps: true },
);
discussionSchema.index({ communityId: 1, status: 1, createdAt: -1, _id: -1 });
discussionSchema.index({ authorId: 1, createdAt: -1, _id: -1 });
export const DiscussionModel: Model<DiscussionDocument> = model<DiscussionDocument>(
  'CommunityDiscussion',
  discussionSchema,
);

export type ReplyStatus = 'ACTIVE' | 'DELETED';
export interface ReplyDocument extends Document {
  discussionId: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  status: ReplyStatus;
  createdAt: Date;
  updatedAt: Date;
}
const replySchema = new Schema<ReplyDocument>(
  {
    discussionId: { type: objectId, required: true },
    authorId: { type: objectId, required: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
    status: { type: String, enum: ['ACTIVE', 'DELETED'], default: 'ACTIVE', index: true },
  },
  { collection: 'community_replies', timestamps: true },
);
replySchema.index({ discussionId: 1, status: 1, createdAt: -1, _id: -1 });
replySchema.index({ authorId: 1, createdAt: -1, _id: -1 });
export const ReplyModel: Model<ReplyDocument> = model<ReplyDocument>('CommunityReply', replySchema);

export interface TeamDocument extends Document {
  name: string;
  description: string;
  goal?: string;
  category?: string;
  tags: string[];
  avatarUrl?: string;
  deadline?: Date;
  lookingFor: string[];
  ownerId: Types.ObjectId;
  projectId?: Types.ObjectId;
  communityId?: Types.ObjectId;
  status: TeamStatus;
  maxMembers?: number;
  visibility: TeamVisibility;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
const teamSchema = new Schema<TeamDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1500 },
    goal: { type: String, trim: true, maxlength: 1500 },
    category: { type: String, trim: true, maxlength: 80, index: true },
    tags: { type: [String], default: [] },
    avatarUrl: { type: String, trim: true, maxlength: 500 },
    deadline: Date,
    lookingFor: { type: [String], default: [] },
    ownerId: { type: objectId, required: true, index: true },
    projectId: objectId,
    communityId: objectId,
    status: {
      type: String,
      enum: ['RECRUITING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
      default: 'RECRUITING',
      index: true,
    },
    maxMembers: { type: Number, min: 1, max: 100 },
    visibility: { type: String, enum: ['PUBLIC', 'CAMPUS', 'PRIVATE'], required: true },
    memberCount: { type: Number, default: 1, min: 0 },
  },
  { collection: 'teams', timestamps: true },
);
teamSchema.index({ projectId: 1, status: 1 });
teamSchema.index({ communityId: 1, status: 1 });
teamSchema.index({ status: 1, createdAt: -1, _id: -1 });
export const TeamModel: Model<TeamDocument> = model<TeamDocument>('Team', teamSchema);

export interface TeamRequirementDocument extends Document {
  teamId: Types.ObjectId;
  roleName: string;
  skills: string[];
  interests: string[];
  experienceLevel?: string;
  slots: number;
  filledSlots: number;
  description: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}
const teamRequirementSchema = new Schema<TeamRequirementDocument>(
  {
    teamId: { type: objectId, required: true, index: true },
    roleName: { type: String, required: true, trim: true, maxlength: 120 },
    skills: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    experienceLevel: { type: String, trim: true, maxlength: 80 },
    slots: { type: Number, required: true, min: 1, max: 100 },
    filledSlots: { type: Number, default: 0, min: 0, max: 100 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    priority: { type: Number, default: 50, min: 0, max: 100 },
  },
  { collection: 'team_requirements', timestamps: true },
);
teamRequirementSchema.index({ teamId: 1, priority: -1, createdAt: -1, _id: -1 });
teamRequirementSchema.index({ skills: 1, teamId: 1 });
export const TeamRequirementModel: Model<TeamRequirementDocument> = model<TeamRequirementDocument>(
  'TeamRequirement',
  teamRequirementSchema,
);

export interface TeamMemberDocument extends Document {
  teamId: Types.ObjectId;
  userId: Types.ObjectId;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joinedAt?: Date;
  leftAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const teamMemberSchema = new Schema<TeamMemberDocument>(
  {
    teamId: { type: objectId, required: true },
    userId: { type: objectId, required: true },
    role: { type: String, enum: ['OWNER', 'CO_LEAD', 'MEMBER', 'ADMIN'], required: true },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'LEFT'], required: true },
    joinedAt: Date,
    leftAt: Date,
  },
  { collection: 'team_members', timestamps: true },
);
teamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });
teamMemberSchema.index({ userId: 1, status: 1 });
teamMemberSchema.index({ teamId: 1, status: 1, role: 1 });
export const TeamMemberModel: Model<TeamMemberDocument> = model<TeamMemberDocument>(
  'TeamMember',
  teamMemberSchema,
);

export interface TeamJoinRequestDocument extends Document {
  teamId: Types.ObjectId;
  userId: Types.ObjectId;
  message?: string;
  status: TeamJoinRequestStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const teamJoinRequestSchema = new Schema<TeamJoinRequestDocument>(
  {
    teamId: { type: objectId, required: true },
    userId: { type: objectId, required: true },
    message: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      required: true,
      index: true,
    },
    reviewedBy: objectId,
    reviewedAt: Date,
  },
  { collection: 'team_join_requests', timestamps: true },
);
teamJoinRequestSchema.index({ teamId: 1, userId: 1, status: 1 });
teamJoinRequestSchema.index({ teamId: 1, status: 1, createdAt: -1, _id: -1 });
export const TeamJoinRequestModel: Model<TeamJoinRequestDocument> = model<TeamJoinRequestDocument>(
  'TeamJoinRequest',
  teamJoinRequestSchema,
);

export interface TeamInvitationDocument extends Document {
  teamId: Types.ObjectId;
  inviterId: Types.ObjectId;
  inviteeId: Types.ObjectId;
  status: TeamInvitationStatus;
  respondedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const teamInvitationSchema = new Schema<TeamInvitationDocument>(
  {
    teamId: { type: objectId, required: true },
    inviterId: { type: objectId, required: true },
    inviteeId: { type: objectId, required: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'], required: true },
    respondedAt: Date,
    expiresAt: Date,
  },
  { collection: 'team_invitations', timestamps: true },
);
teamInvitationSchema.index({ inviteeId: 1, status: 1 });
teamInvitationSchema.index({ teamId: 1, status: 1 });
export const TeamInvitationModel: Model<TeamInvitationDocument> = model<TeamInvitationDocument>(
  'TeamInvitation',
  teamInvitationSchema,
);

export interface ProjectDocument extends Document {
  name: string;
  slug: string;
  description: string;
  objective?: string;
  category?: string;
  tags: string[];
  ownerTeamId?: Types.ObjectId;
  teamId?: Types.ObjectId;
  ownerId: Types.ObjectId;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  technologies: string[];
  lookingFor: string[];
  deadline?: Date;
  repositoryUrl?: string;
  demoUrl?: string;
  coverImageUrl?: string;
  showcaseEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
const projectSchema = new Schema<ProjectDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 90,
    },
    description: { type: String, required: true, trim: true, maxlength: 2500 },
    objective: { type: String, trim: true, maxlength: 1500 },
    category: { type: String, trim: true, maxlength: 80, index: true },
    tags: { type: [String], default: [] },
    ownerTeamId: objectId,
    teamId: objectId,
    ownerId: { type: objectId, required: true, index: true },
    status: {
      type: String,
      enum: ['PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED'],
      default: 'PLANNING',
      index: true,
    },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'CAMPUS', 'CONNECTIONS', 'PRIVATE'],
      required: true,
    },
    technologies: { type: [String], default: [] },
    lookingFor: { type: [String], default: [] },
    deadline: Date,
    repositoryUrl: String,
    demoUrl: String,
    coverImageUrl: String,
    showcaseEnabled: { type: Boolean, default: false },
    completedAt: Date,
  },
  { collection: 'projects', timestamps: true },
);
projectSchema.index({ ownerTeamId: 1, status: 1 });
projectSchema.index({ teamId: 1, status: 1 });
projectSchema.index({ category: 1, status: 1 });
projectSchema.index({ tags: 1, status: 1 });
projectSchema.index({ status: 1, createdAt: -1, _id: -1 });
export const ProjectModel: Model<ProjectDocument> = model<ProjectDocument>(
  'Project',
  projectSchema,
);

export interface ProjectMemberDocument extends Document {
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  role: ProjectMemberRole;
  status: ProjectMemberStatus;
  joinedAt?: Date;
  leftAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const projectMemberSchema = new Schema<ProjectMemberDocument>(
  {
    projectId: { type: objectId, required: true },
    userId: { type: objectId, required: true },
    role: { type: String, enum: ['OWNER', 'COLLABORATOR', 'MANAGER', 'MEMBER'], required: true },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'LEFT'], required: true },
    joinedAt: Date,
    leftAt: Date,
  },
  { collection: 'project_members', timestamps: true },
);
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMemberSchema.index({ userId: 1, status: 1 });
projectMemberSchema.index({ projectId: 1, status: 1, role: 1 });
export const ProjectMemberModel: Model<ProjectMemberDocument> = model<ProjectMemberDocument>(
  'ProjectMember',
  projectMemberSchema,
);

export interface ProjectJoinRequestDocument extends Document {
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  message?: string;
  status: ProjectJoinRequestStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const projectJoinRequestSchema = new Schema<ProjectJoinRequestDocument>(
  {
    projectId: { type: objectId, required: true },
    userId: { type: objectId, required: true },
    message: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      required: true,
      index: true,
    },
    reviewedBy: objectId,
    reviewedAt: Date,
  },
  { collection: 'project_join_requests', timestamps: true },
);
projectJoinRequestSchema.index({ projectId: 1, userId: 1, status: 1 });
projectJoinRequestSchema.index({ projectId: 1, status: 1, createdAt: -1, _id: -1 });
export const ProjectJoinRequestModel: Model<ProjectJoinRequestDocument> =
  model<ProjectJoinRequestDocument>('ProjectJoinRequest', projectJoinRequestSchema);

export interface ProjectInvitationDocument extends Document {
  projectId: Types.ObjectId;
  inviterId: Types.ObjectId;
  inviteeId: Types.ObjectId;
  status: ProjectInvitationStatus;
  createdAt: Date;
  respondedAt?: Date;
  expiresAt?: Date;
  updatedAt: Date;
}
const projectInvitationSchema = new Schema<ProjectInvitationDocument>(
  {
    projectId: { type: objectId, required: true },
    inviterId: { type: objectId, required: true },
    inviteeId: { type: objectId, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
      required: true,
      index: true,
    },
    respondedAt: Date,
    expiresAt: Date,
  },
  { collection: 'project_invitations', timestamps: true },
);
projectInvitationSchema.index({ projectId: 1, inviteeId: 1, status: 1 });
projectInvitationSchema.index({ inviteeId: 1, status: 1, createdAt: -1 });
export const ProjectInvitationModel: Model<ProjectInvitationDocument> =
  model<ProjectInvitationDocument>('ProjectInvitation', projectInvitationSchema);

export interface ProjectResourceDocument extends Document {
  projectId: Types.ObjectId;
  title: string;
  url: string;
  type: ProjectResourceType;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const projectResourceSchema = new Schema<ProjectResourceDocument>(
  {
    projectId: { type: objectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    url: { type: String, required: true, trim: true, maxlength: 500 },
    type: {
      type: String,
      enum: ['REPOSITORY', 'DEMO', 'DOCUMENTATION', 'DESIGN', 'OTHER'],
      required: true,
    },
    createdBy: { type: objectId, required: true },
  },
  { collection: 'project_resources', timestamps: true },
);
projectResourceSchema.index({ projectId: 1, createdAt: -1, _id: -1 });
export const ProjectResourceModel: Model<ProjectResourceDocument> = model<ProjectResourceDocument>(
  'ProjectResource',
  projectResourceSchema,
);

export interface ProjectActivityDocument extends Document {
  projectId: Types.ObjectId;
  actorId: Types.ObjectId;
  type: string;
  message: string;
  metadata?: Record<string, string>;
  createdAt: Date;
}
const projectActivitySchema = new Schema<ProjectActivityDocument>(
  {
    projectId: { type: objectId, required: true, index: true },
    actorId: { type: objectId, required: true },
    type: { type: String, required: true, maxlength: 80 },
    message: { type: String, required: true, maxlength: 500 },
    metadata: { type: Map, of: String },
  },
  { collection: 'project_activity', timestamps: { createdAt: true, updatedAt: false } },
);
projectActivitySchema.index({ projectId: 1, createdAt: -1, _id: -1 });
export const ProjectActivityModel: Model<ProjectActivityDocument> = model<ProjectActivityDocument>(
  'ProjectActivity',
  projectActivitySchema,
);

export interface TaskDocument extends Document {
  projectId: Types.ObjectId;
  title: string;
  description: string;
  creatorId: Types.ObjectId;
  assigneeId?: Types.ObjectId;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  completedAt?: Date;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const taskSchema = new Schema<TaskDocument>(
  {
    projectId: { type: objectId, required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    creatorId: { type: objectId, required: true },
    assigneeId: objectId,
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'DONE'],
      default: 'TODO',
      index: true,
    },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    dueDate: Date,
    completedAt: Date,
    archivedAt: Date,
    archivedBy: objectId,
  },
  { collection: 'project_tasks', timestamps: true },
);
taskSchema.index({ projectId: 1, createdAt: -1, _id: -1 });
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ assigneeId: 1, status: 1 });
export const TaskModel: Model<TaskDocument> = model<TaskDocument>('ProjectTask', taskSchema);

export interface MilestoneDocument extends Document {
  projectId: Types.ObjectId;
  title: string;
  description: string;
  createdBy?: Types.ObjectId;
  status: MilestoneStatus;
  dueDate?: Date;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}
const milestoneSchema = new Schema<MilestoneDocument>(
  {
    projectId: { type: objectId, required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    createdBy: objectId,
    status: {
      type: String,
      enum: ['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'PLANNED'],
      default: 'UPCOMING',
    },
    dueDate: Date,
    order: { type: Number, min: 0, required: true },
  },
  { collection: 'project_milestones', timestamps: true },
);
milestoneSchema.index({ projectId: 1, order: 1 });
milestoneSchema.index({ projectId: 1, dueDate: 1 });
export const MilestoneModel: Model<MilestoneDocument> = model<MilestoneDocument>(
  'ProjectMilestone',
  milestoneSchema,
);

export interface EventDocument extends Document {
  title: string;
  description: string;
  organizerId: Types.ObjectId;
  category: string;
  tags: string[];
  coverImageUrl?: string;
  venue?: string;
  mode: EventMode;
  meetingLink?: string;
  startAt: Date;
  endAt: Date;
  registrationDeadline?: Date;
  capacity?: number;
  registrationCount: number;
  visibility: EventVisibility;
  status: EventStatus;
  registrationRequired: boolean;
  rules: string[];
  teamId?: Types.ObjectId;
  communityId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<EventDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    organizerId: { type: objectId, required: true, index: true },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    tags: { type: [String], default: [] },
    coverImageUrl: String,
    venue: { type: String, trim: true, maxlength: 300 },
    mode: { type: String, enum: ['OFFLINE', 'ONLINE', 'HYBRID'], required: true },
    meetingLink: { type: String, trim: true, maxlength: 500 },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    registrationDeadline: Date,
    capacity: { type: Number, min: 1 },
    registrationCount: { type: Number, min: 0, default: 0 },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'CAMPUS', 'PRIVATE'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ARCHIVED'],
      default: 'UPCOMING',
      index: true,
    },
    registrationRequired: { type: Boolean, default: true },
    rules: { type: [String], default: [] },
    teamId: objectId,
    communityId: objectId,
  },
  { collection: 'events', timestamps: true },
);
eventSchema.index({ status: 1, visibility: 1, startAt: 1, _id: 1 });
eventSchema.index({ category: 1, startAt: 1, _id: 1 });
eventSchema.index({ tags: 1, startAt: 1, _id: 1 });
export const EventModel: Model<EventDocument> = model<EventDocument>('Event', eventSchema);

export interface EventRegistrationDocument extends Document {
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  status: EventRegistrationStatus;
  registeredAt: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const eventRegistrationSchema = new Schema<EventRegistrationDocument>(
  {
    eventId: { type: objectId, required: true, index: true },
    userId: { type: objectId, required: true, index: true },
    status: {
      type: String,
      enum: ['REGISTERED', 'CANCELLED', 'ATTENDED', 'NO_SHOW'],
      required: true,
      index: true,
    },
    registeredAt: { type: Date, required: true },
    cancelledAt: Date,
  },
  { collection: 'event_registrations', timestamps: true },
);
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
eventRegistrationSchema.index({ eventId: 1, status: 1, registeredAt: -1, _id: -1 });
eventRegistrationSchema.index({ userId: 1, status: 1, registeredAt: -1 });
export const EventRegistrationModel: Model<EventRegistrationDocument> =
  model<EventRegistrationDocument>('EventRegistration', eventRegistrationSchema);

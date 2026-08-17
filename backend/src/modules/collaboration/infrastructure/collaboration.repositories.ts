import type { ClientSession, FilterQuery } from 'mongoose';
import {
  CommunityMemberModel,
  CommunityJoinRequestModel,
  CommunityInvitationModel,
  CommunityBanModel,
  CommunityReportModel,
  CommunityModel,
  DiscussionModel,
  EventModel,
  EventRegistrationModel,
  ReplyModel,
  MilestoneModel,
  ProjectActivityModel,
  ProjectInvitationModel,
  ProjectJoinRequestModel,
  ProjectMemberModel,
  ProjectModel,
  ProjectResourceModel,
  TaskModel,
  TeamInvitationModel,
  TeamJoinRequestModel,
  TeamMemberModel,
  TeamModel,
  TeamRequirementModel,
  type CommunityDocument,
  type CommunityMemberDocument,
  type CommunityJoinRequestDocument,
  type CommunityInvitationDocument,
  type CommunityBanDocument,
  type CommunityReportDocument,
  type DiscussionDocument,
  type EventDocument,
  type EventRegistrationDocument,
  type ReplyDocument,
  type MilestoneDocument,
  type ProjectActivityDocument,
  type ProjectInvitationDocument,
  type ProjectJoinRequestDocument,
  type ProjectDocument,
  type ProjectMemberDocument,
  type ProjectResourceDocument,
  type TaskDocument,
  type TeamDocument,
  type TeamInvitationDocument,
  type TeamJoinRequestDocument,
  type TeamMemberDocument,
  type TeamRequirementDocument,
} from './collaboration.models';

const opts = (session?: ClientSession) => (session ? { session } : {});
export class CommunityRepository {
  findById(id: string, session?: ClientSession) {
    return CommunityModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  findBySlug(slug: string, session?: ClientSession) {
    return CommunityModel.findOne({ slug })
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<CommunityDocument>, session?: ClientSession) {
    const [doc] = await CommunityModel.create([input], opts(session));
    if (!doc) throw new Error('Community creation returned no document');
    return doc;
  }
  async update(id: string, changes: Partial<CommunityDocument>, session?: ClientSession) {
    return (await CommunityModel.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as CommunityDocument | null;
  }
  list(filter: FilterQuery<CommunityDocument>, limit: number, session?: ClientSession) {
    return CommunityModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  listMemberCommunities(userId: string, limit: number, session?: ClientSession) {
    return CommunityMemberModel.find({ userId, status: 'ACTIVE' })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  countMembers(communityId: string, session?: ClientSession) {
    return CommunityMemberModel.countDocuments({ communityId, status: 'ACTIVE' })
      .session(session ?? null)
      .exec();
  }
  incrementMemberCount(communityId: string, delta: number, session?: ClientSession) {
    return CommunityModel.findByIdAndUpdate(
      communityId,
      { $inc: { memberCount: delta } },
      { new: true, session: session ?? null },
    ).exec();
  }
  findMember(communityId: string, userId: string, session?: ClientSession) {
    return CommunityMemberModel.findOne({ communityId, userId })
      .session(session ?? null)
      .exec();
  }
  async saveMember(
    communityId: string,
    userId: string,
    changes: Partial<CommunityMemberDocument>,
    session?: ClientSession,
  ) {
    return (await CommunityMemberModel.findOneAndUpdate(
      { communityId, userId },
      { $set: changes },
      { new: true, upsert: true, session: session ?? null, setDefaultsOnInsert: true },
    ).exec()) as unknown as CommunityMemberDocument;
  }
  async updateMember(
    communityId: string,
    userId: string,
    changes: Partial<CommunityMemberDocument>,
    session?: ClientSession,
  ) {
    return (await CommunityMemberModel.findOneAndUpdate(
      { communityId, userId },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as CommunityMemberDocument | null;
  }
  listMembers(
    communityId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return CommunityMemberModel.find({ communityId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  listJoinRequests(
    communityId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return CommunityJoinRequestModel.find({ communityId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  findJoinRequest(id: string, session?: ClientSession) {
    return CommunityJoinRequestModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async createJoinRequest(input: Partial<CommunityJoinRequestDocument>, session?: ClientSession) {
    const [doc] = await CommunityJoinRequestModel.create([input], opts(session));
    if (!doc) throw new Error('Community join request creation returned no document');
    return doc;
  }
  updateJoinRequest(
    id: string,
    changes: Partial<CommunityJoinRequestDocument>,
    session?: ClientSession,
  ) {
    return CommunityJoinRequestModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  findPendingJoinRequest(communityId: string, userId: string, session?: ClientSession) {
    return CommunityJoinRequestModel.findOne({ communityId, userId, status: 'PENDING' })
      .session(session ?? null)
      .exec();
  }
  listInvitations(filter: Record<string, unknown>, limit: number, session?: ClientSession) {
    return CommunityInvitationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  findInvitation(id: string, session?: ClientSession) {
    return CommunityInvitationModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  findPendingInvitation(communityId: string, inviteeId: string, session?: ClientSession) {
    return CommunityInvitationModel.findOne({ communityId, inviteeId, status: 'PENDING' })
      .session(session ?? null)
      .exec();
  }
  async createInvitation(input: Partial<CommunityInvitationDocument>, session?: ClientSession) {
    const [doc] = await CommunityInvitationModel.create([input], opts(session));
    if (!doc) throw new Error('Community invitation creation returned no document');
    return doc;
  }
  updateInvitation(
    id: string,
    changes: Partial<CommunityInvitationDocument>,
    session?: ClientSession,
  ) {
    return CommunityInvitationModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  listBans(
    communityId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return CommunityBanModel.find({ communityId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  findActiveBan(communityId: string, userId: string, session?: ClientSession) {
    return CommunityBanModel.findOne({
      communityId,
      userId,
      status: 'ACTIVE',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .session(session ?? null)
      .exec();
  }
  async createBan(input: Partial<CommunityBanDocument>, session?: ClientSession) {
    const [doc] = await CommunityBanModel.create([input], opts(session));
    if (!doc) throw new Error('Community ban creation returned no document');
    return doc;
  }
  updateBan(
    communityId: string,
    userId: string,
    changes: Partial<CommunityBanDocument>,
    session?: ClientSession,
  ) {
    return CommunityBanModel.findOneAndUpdate(
      { communityId, userId, status: 'ACTIVE' },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  listReports(
    communityId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return CommunityReportModel.find({ communityId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async createReport(input: Partial<CommunityReportDocument>, session?: ClientSession) {
    const [doc] = await CommunityReportModel.create([input], opts(session));
    if (!doc) throw new Error('Community report creation returned no document');
    return doc;
  }
  updateReport(id: string, changes: Partial<CommunityReportDocument>, session?: ClientSession) {
    return CommunityReportModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
}

export class DiscussionRepository {
  findById(id: string, session?: ClientSession) {
    return DiscussionModel.findOne({ _id: id, status: 'ACTIVE' })
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<DiscussionDocument>, session?: ClientSession) {
    const [doc] = await DiscussionModel.create([input], opts(session));
    if (!doc) throw new Error('Discussion creation returned no document');
    return doc;
  }
  list(filter: FilterQuery<DiscussionDocument>, limit: number, session?: ClientSession) {
    return DiscussionModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async incrementReplyCount(id: string, session?: ClientSession) {
    return DiscussionModel.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $inc: { replyCount: 1 } },
      { new: true, session: session ?? null },
    ).exec();
  }
}

export class ReplyRepository {
  async create(input: Partial<ReplyDocument>, session?: ClientSession) {
    const [doc] = await ReplyModel.create([input], opts(session));
    if (!doc) throw new Error('Reply creation returned no document');
    return doc;
  }
  list(filter: FilterQuery<ReplyDocument>, limit: number, session?: ClientSession) {
    return ReplyModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
}

export class TeamRepository {
  findById(id: string, session?: ClientSession) {
    return TeamModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<TeamDocument>, session?: ClientSession) {
    const [doc] = await TeamModel.create([input], opts(session));
    if (!doc) throw new Error('Team creation returned no document');
    return doc;
  }
  async update(id: string, changes: Partial<TeamDocument>, session?: ClientSession) {
    return (await TeamModel.findOneAndUpdate(
      { _id: id, status: { $ne: 'ARCHIVED' } },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as TeamDocument | null;
  }
  list(filter: FilterQuery<TeamDocument>, limit: number, session?: ClientSession) {
    return TeamModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  findMember(teamId: string, userId: string, session?: ClientSession) {
    return TeamMemberModel.findOne({ teamId, userId })
      .session(session ?? null)
      .exec();
  }
  async saveMember(
    teamId: string,
    userId: string,
    changes: Partial<TeamMemberDocument>,
    session?: ClientSession,
  ) {
    return (await TeamMemberModel.findOneAndUpdate(
      { teamId, userId },
      { $set: changes },
      { new: true, upsert: true, session: session ?? null, setDefaultsOnInsert: true },
    ).exec()) as unknown as TeamMemberDocument;
  }
  async updateMember(
    teamId: string,
    userId: string,
    changes: Partial<TeamMemberDocument>,
    session?: ClientSession,
  ) {
    return (await TeamMemberModel.findOneAndUpdate(
      { teamId, userId },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as TeamMemberDocument | null;
  }
  listMembers(
    teamId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return TeamMemberModel.find({ teamId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  incrementMemberCount(teamId: string, delta: number, session?: ClientSession) {
    return TeamModel.findByIdAndUpdate(
      teamId,
      { $inc: { memberCount: delta } },
      { new: true, session: session ?? null },
    ).exec();
  }
  reserveMemberSlot(teamId: string, maxMembers: number | undefined, session?: ClientSession) {
    const filter = maxMembers
      ? { _id: teamId, status: { $in: ['RECRUITING', 'ACTIVE'] }, memberCount: { $lt: maxMembers } }
      : { _id: teamId, status: { $in: ['RECRUITING', 'ACTIVE'] } };
    return TeamModel.findOneAndUpdate(
      filter,
      { $inc: { memberCount: 1 } },
      { new: true, session: session ?? null },
    ).exec();
  }
  countMembers(teamId: string, session?: ClientSession) {
    return TeamMemberModel.countDocuments({ teamId, status: 'ACTIVE' })
      .session(session ?? null)
      .exec();
  }
  findJoinRequest(id: string, session?: ClientSession) {
    return TeamJoinRequestModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  findPendingJoinRequest(teamId: string, userId: string, session?: ClientSession) {
    return TeamJoinRequestModel.findOne({ teamId, userId, status: 'PENDING' })
      .session(session ?? null)
      .exec();
  }
  listJoinRequests(
    teamId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return TeamJoinRequestModel.find({ teamId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async createJoinRequest(input: Partial<TeamJoinRequestDocument>, session?: ClientSession) {
    const [doc] = await TeamJoinRequestModel.create([input], opts(session));
    if (!doc) throw new Error('Team join request creation returned no document');
    return doc;
  }
  updateJoinRequest(
    id: string,
    changes: Partial<TeamJoinRequestDocument>,
    session?: ClientSession,
  ) {
    return TeamJoinRequestModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  findInvitation(id: string, session?: ClientSession) {
    return TeamInvitationModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  findPendingInvitation(teamId: string, inviteeId: string, session?: ClientSession) {
    return TeamInvitationModel.findOne({ teamId, inviteeId, status: 'PENDING' })
      .session(session ?? null)
      .exec();
  }
  listInvitations(filter: Record<string, unknown>, limit: number, session?: ClientSession) {
    return TeamInvitationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async createInvitation(input: Partial<TeamInvitationDocument>, session?: ClientSession) {
    const [doc] = await TeamInvitationModel.create([input], opts(session));
    if (!doc) throw new Error('Team invitation creation returned no document');
    return doc;
  }
  async updateInvitation(
    id: string,
    changes: Partial<TeamInvitationDocument>,
    session?: ClientSession,
  ) {
    return (await TeamInvitationModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as TeamInvitationDocument | null;
  }
  listRequirements(teamId: string, session?: ClientSession) {
    return TeamRequirementModel.find({ teamId })
      .sort({ priority: -1, createdAt: -1, _id: -1 })
      .session(session ?? null)
      .exec();
  }
  findRequirement(id: string, session?: ClientSession) {
    return TeamRequirementModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async createRequirement(input: Partial<TeamRequirementDocument>, session?: ClientSession) {
    const [doc] = await TeamRequirementModel.create([input], opts(session));
    if (!doc) throw new Error('Team requirement creation returned no document');
    return doc;
  }
  async updateRequirement(
    id: string,
    changes: Partial<TeamRequirementDocument>,
    session?: ClientSession,
  ) {
    return (await TeamRequirementModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as TeamRequirementDocument | null;
  }
  async deleteRequirement(id: string, session?: ClientSession) {
    return TeamRequirementModel.findByIdAndDelete(id, { session: session ?? null }).exec();
  }
}

export class ProjectRepository {
  findById(id: string, session?: ClientSession) {
    return ProjectModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<ProjectDocument>, session?: ClientSession) {
    const [doc] = await ProjectModel.create([input], opts(session));
    if (!doc) throw new Error('Project creation returned no document');
    return doc;
  }
  async update(id: string, changes: Partial<ProjectDocument>, session?: ClientSession) {
    return (await ProjectModel.findOneAndUpdate(
      { _id: id, status: { $ne: 'ARCHIVED' } },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as ProjectDocument | null;
  }
  list(filter: FilterQuery<ProjectDocument>, limit: number, session?: ClientSession) {
    return ProjectModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  findMember(projectId: string, userId: string, session?: ClientSession) {
    return ProjectMemberModel.findOne({ projectId, userId })
      .session(session ?? null)
      .exec();
  }
  async saveMember(
    projectId: string,
    userId: string,
    changes: Partial<ProjectMemberDocument>,
    session?: ClientSession,
  ) {
    return (await ProjectMemberModel.findOneAndUpdate(
      { projectId, userId },
      { $set: changes },
      { new: true, upsert: true, session: session ?? null, setDefaultsOnInsert: true },
    ).exec()) as unknown as ProjectMemberDocument;
  }
  async updateMember(
    projectId: string,
    userId: string,
    changes: Partial<ProjectMemberDocument>,
    session?: ClientSession,
  ) {
    return (await ProjectMemberModel.findOneAndUpdate(
      { projectId, userId },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as ProjectMemberDocument | null;
  }
  listMembers(
    projectId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return ProjectMemberModel.find({ projectId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  countMembers(projectId: string, session?: ClientSession) {
    return ProjectMemberModel.countDocuments({ projectId, status: 'ACTIVE' })
      .session(session ?? null)
      .exec();
  }
  findJoinRequest(id: string, session?: ClientSession) {
    return ProjectJoinRequestModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  findPendingJoinRequest(projectId: string, userId: string, session?: ClientSession) {
    return ProjectJoinRequestModel.findOne({ projectId, userId, status: 'PENDING' })
      .session(session ?? null)
      .exec();
  }
  listJoinRequests(
    projectId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return ProjectJoinRequestModel.find({ projectId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async createJoinRequest(input: Partial<ProjectJoinRequestDocument>, session?: ClientSession) {
    const [doc] = await ProjectJoinRequestModel.create([input], opts(session));
    if (!doc) throw new Error('Project join request creation returned no document');
    return doc;
  }
  updateJoinRequest(
    id: string,
    changes: Partial<ProjectJoinRequestDocument>,
    session?: ClientSession,
  ) {
    return ProjectJoinRequestModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  findInvitation(id: string, session?: ClientSession) {
    return ProjectInvitationModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  findPendingInvitation(projectId: string, inviteeId: string, session?: ClientSession) {
    return ProjectInvitationModel.findOne({ projectId, inviteeId, status: 'PENDING' })
      .session(session ?? null)
      .exec();
  }
  listInvitations(filter: Record<string, unknown>, limit: number, session?: ClientSession) {
    return ProjectInvitationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async createInvitation(input: Partial<ProjectInvitationDocument>, session?: ClientSession) {
    const [doc] = await ProjectInvitationModel.create([input], opts(session));
    if (!doc) throw new Error('Project invitation creation returned no document');
    return doc;
  }
  updateInvitation(
    id: string,
    changes: Partial<ProjectInvitationDocument>,
    session?: ClientSession,
  ) {
    return ProjectInvitationModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  async createTask(input: Partial<TaskDocument>, session?: ClientSession) {
    const [doc] = await TaskModel.create([input], opts(session));
    if (!doc) throw new Error('Task creation returned no document');
    return doc;
  }
  findTask(id: string, session?: ClientSession) {
    return TaskModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async updateTask(id: string, changes: Partial<TaskDocument>, session?: ClientSession) {
    return (await TaskModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as TaskDocument | null;
  }
  listTasks(
    projectId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return TaskModel.find({ projectId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async createMilestone(input: Partial<MilestoneDocument>, session?: ClientSession) {
    const [doc] = await MilestoneModel.create([input], opts(session));
    if (!doc) throw new Error('Milestone creation returned no document');
    return doc;
  }
  findMilestone(id: string, session?: ClientSession) {
    return MilestoneModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async updateMilestone(id: string, changes: Partial<MilestoneDocument>, session?: ClientSession) {
    return (await MilestoneModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as MilestoneDocument | null;
  }
  deleteMilestone(id: string, session?: ClientSession) {
    return MilestoneModel.findByIdAndDelete(id, { session: session ?? null }).exec();
  }
  listMilestones(projectId: string, limit: number, session?: ClientSession) {
    return MilestoneModel.find({ projectId })
      .sort({ order: 1, createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async createResource(input: Partial<ProjectResourceDocument>, session?: ClientSession) {
    const [doc] = await ProjectResourceModel.create([input], opts(session));
    if (!doc) throw new Error('Project resource creation returned no document');
    return doc;
  }
  findResource(id: string, session?: ClientSession) {
    return ProjectResourceModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  listResources(projectId: string, limit: number, session?: ClientSession) {
    return ProjectResourceModel.find({ projectId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  updateResource(id: string, changes: Partial<ProjectResourceDocument>, session?: ClientSession) {
    return ProjectResourceModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  deleteResource(id: string, session?: ClientSession) {
    return ProjectResourceModel.findByIdAndDelete(id, { session: session ?? null }).exec();
  }
  createActivity(input: Partial<ProjectActivityDocument>, session?: ClientSession) {
    return ProjectActivityModel.create([input], opts(session)).then(([doc]) => {
      if (!doc) throw new Error('Project activity creation returned no document');
      return doc;
    });
  }
  listActivity(projectId: string, limit: number, session?: ClientSession) {
    return ProjectActivityModel.find({ projectId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
}

export class EventRepository {
  findById(id: string, session?: ClientSession) {
    return EventModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<EventDocument>, session?: ClientSession) {
    const [doc] = await EventModel.create([input], opts(session));
    if (!doc) throw new Error('Event creation returned no document');
    return doc;
  }
  update(id: string, changes: Partial<EventDocument>, session?: ClientSession) {
    return EventModel.findOneAndUpdate(
      { _id: id, status: { $ne: 'ARCHIVED' } },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  list(filter: FilterQuery<EventDocument>, limit: number, session?: ClientSession) {
    return EventModel.find(filter)
      .sort({ startAt: 1, _id: 1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  async reserveRegistration(eventId: string, userId: string, now: Date, session?: ClientSession) {
    const event = await EventModel.findOneAndUpdate(
      {
        _id: eventId,
        status: { $in: ['UPCOMING', 'ONGOING'] },
        endAt: { $gt: now },
        registrationRequired: true,
        $or: [
          { registrationDeadline: { $exists: false } },
          { registrationDeadline: null },
          { registrationDeadline: { $gt: now } },
        ],
        $and: [
          {
            $or: [
              { capacity: { $exists: false } },
              { $expr: { $lt: ['$registrationCount', '$capacity'] } },
            ],
          },
        ],
      },
      { $inc: { registrationCount: 1 } },
      { new: true, session: session ?? null },
    ).exec();
    if (!event) return null;
    const existing = await EventRegistrationModel.findOne({ eventId, userId })
      .session(session ?? null)
      .exec();
    const registration = existing
      ? await EventRegistrationModel.findOneAndUpdate(
          { _id: existing._id, status: 'CANCELLED' },
          { $set: { status: 'REGISTERED', registeredAt: now }, $unset: { cancelledAt: 1 } },
          { new: true, session: session ?? null },
        ).exec()
      : (
          await EventRegistrationModel.create(
            [{ eventId, userId, status: 'REGISTERED', registeredAt: now }],
            opts(session),
          )
        )[0];
    if (!registration) throw new Error('The event registration is no longer available');
    return { event, registration };
  }
  findRegistration(eventId: string, userId: string, session?: ClientSession) {
    return EventRegistrationModel.findOne({ eventId, userId })
      .session(session ?? null)
      .exec();
  }
  cancelRegistration(eventId: string, userId: string, now: Date, session?: ClientSession) {
    return EventRegistrationModel.findOneAndUpdate(
      { eventId, userId, status: 'REGISTERED' },
      { $set: { status: 'CANCELLED', cancelledAt: now } },
      { new: true, session: session ?? null },
    ).exec();
  }
  decrementRegistrationCount(eventId: string, session?: ClientSession) {
    return EventModel.findOneAndUpdate(
      { _id: eventId, registrationCount: { $gt: 0 } },
      { $inc: { registrationCount: -1 } },
      { new: true, session: session ?? null },
    ).exec();
  }
  listRegistrations(
    eventId: string,
    filter: Record<string, unknown>,
    limit: number,
    session?: ClientSession,
  ) {
    return EventRegistrationModel.find({ eventId, ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  updateRegistration(
    id: string,
    changes: Partial<EventRegistrationDocument>,
    session?: ClientSession,
  ) {
    return EventRegistrationModel.findByIdAndUpdate(
      id,
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
}

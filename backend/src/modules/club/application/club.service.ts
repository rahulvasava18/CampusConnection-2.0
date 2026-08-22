import { Types } from 'mongoose';
import type {
  ApiCollection,
  ClubStatus,
  EventMode,
  EventVisibility,
} from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { UserRepository } from '../../identity/infrastructure/identity.repositories';
import { EventModel, type EventDocument } from '../../collaboration/infrastructure/collaboration.models';
import { ClubInvitationModel, ClubJoinRequestModel, ClubMembershipModel, ClubModel, type ClubDocument, type ClubInvitationDocument, type ClubJoinRequestDocument } from '../infrastructure/club.models';

export interface ClubActor {
  userId: string;
  accountState: string;
  roles: string[];
}

interface ClubPageInput {
  limit: number;
  cursor?: string;
  search?: string;
  category?: string;
  privacy?: 'PUBLIC' | 'PRIVATE';
  status?: ClubStatus;
}

function objectId(value: string) {
  if (!Types.ObjectId.isValid(value))
    throw new AppError('VALIDATION_ERROR', 'Expected a MongoDB identifier.', 422);
  return new Types.ObjectId(value);
}

function safeRegex(value?: string) {
  return value?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ClubService {
  private readonly users = new UserRepository();

  private active(actor: ClubActor) {
    if (actor.accountState !== 'ACTIVE')
      throw new AppError('ACCOUNT_RESTRICTED', 'Your account cannot perform this club action.', 403);
  }

  private async requireClub(clubId: string) {
    const club = await ClubModel.findById(objectId(clubId)).exec();
    if (!club) throw new AppError('RESOURCE_NOT_FOUND', 'The club was not found.', 404);
    return club;
  }

  private async requireActiveMember(clubId: string, userId: string) {
    return ClubMembershipModel.findOne({ clubId: objectId(clubId), userId: objectId(userId), status: 'ACTIVE' }).exec();
  }

  private async requireOwner(clubId: string, actor: ClubActor) {
    const club = await this.requireClub(clubId);
    if (club.ownerId.toString() !== actor.userId || club.status === 'SUSPENDED')
      throw new AppError('FORBIDDEN', 'Only the club owner can perform this action.', 403);
    return club;
  }

  private async requireEventManager(clubId: string, actor: ClubActor) {
    const club = await this.requireClub(clubId);
    const membership = await this.requireActiveMember(clubId, actor.userId);
    if (club.status !== 'APPROVED')
      throw new AppError('CLUB_NOT_APPROVED', 'Only an approved club can manage events.', 403);
    if (!membership || !['OWNER', 'SECRETARY'].includes(membership.role))
      throw new AppError('FORBIDDEN', 'Only club owners and secretaries can manage events.', 403);
    return { club, membership };
  }

  private async clubView(club: ClubDocument, actor: ClubActor) {
    const [member, memberCount, secretaryCount, eventCount, request] = await Promise.all([
      this.requireActiveMember(club.id, actor.userId),
      ClubMembershipModel.countDocuments({ clubId: club._id, status: 'ACTIVE' }).exec(),
      ClubMembershipModel.countDocuments({ clubId: club._id, status: 'ACTIVE', role: 'SECRETARY' }).exec(),
      EventModel.countDocuments({ organizerClub: club._id, status: { $ne: 'ARCHIVED' } }).exec(),
      ClubJoinRequestModel.findOne({ clubId: club._id, userId: objectId(actor.userId), status: 'PENDING' }).exec(),
    ]);
    const privateDetailsHidden = club.privacy === 'PRIVATE' && !member && club.ownerId.toString() !== actor.userId;
    return {
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: privateDetailsHidden ? 'Request access to view this private club\'s details.' : club.description,
      ...(!privateDetailsHidden && club.shortDescription ? { shortDescription: club.shortDescription } : {}),
      category: club.category,
      tags: privateDetailsHidden ? [] : club.tags ?? [],
      ...(club.logoUrl ? { logoUrl: club.logoUrl } : {}),
      ...(club.bannerUrl ? { bannerUrl: club.bannerUrl } : {}),
      ...(!privateDetailsHidden && club.collegeId ? { collegeId: club.collegeId } : {}),
      contactEmail: privateDetailsHidden ? '' : club.contactEmail,
      ...(!privateDetailsHidden && club.website ? { website: club.website } : {}),
      privacy: club.privacy,
      status: club.status,
      ownerId: club.ownerId.toString(),
      memberCount,
      secretaryCount,
      eventCount,
      isMember: Boolean(member),
      ...(member ? { membershipRole: member.role, membershipStatus: member.status } : {}),
      ...(request ? { joinRequestStatus: request.status } : {}),
      createdAt: club.createdAt.toISOString(),
      updatedAt: club.updatedAt.toISOString(),
    };
  }

  async list(actor: ClubActor, input: ClubPageInput): Promise<ApiCollection<Awaited<ReturnType<ClubService['clubView']>>>> {
    this.active(actor);
    const search = safeRegex(input.search);
    const filter: Record<string, unknown> = {
      status: input.status ?? 'APPROVED',
      ...(input.category ? { category: input.category } : {}),
      ...(input.privacy ? { privacy: input.privacy } : {}),
      ...(search ? { $or: [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }, { tags: new RegExp(search, 'i') }] } : {}),
    };
    const items = await ClubModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(input.limit + 1).exec();
    const data = [];
    for (const club of items.slice(0, input.limit)) data.push(await this.clubView(club, actor));
    return { data, pagination: { hasMore: items.length > input.limit, nextCursor: null } };
  }

  async getMine(actor: ClubActor) {
    this.active(actor);
    const items = await ClubModel.find({ ownerId: objectId(actor.userId) }).sort({ createdAt: -1 }).limit(50).exec();
    return { data: await Promise.all(items.map((club) => this.clubView(club, actor))), pagination: { hasMore: false, nextCursor: null } };
  }

  async get(actor: ClubActor, clubId: string) {
    this.active(actor);
    const club = await this.requireClub(clubId);
    const member = await this.requireActiveMember(clubId, actor.userId);
    if (club.status !== 'APPROVED' && club.ownerId.toString() !== actor.userId)
      throw new AppError('RESOURCE_NOT_FOUND', 'The club was not found.', 404);
    if (club.privacy === 'PRIVATE' && !member && club.ownerId.toString() !== actor.userId)
      return this.clubView(club, actor);
    return this.clubView(club, actor);
  }

  async create(actor: ClubActor, input: { name: string; slug: string; shortDescription?: string; description: string; category: string; tags: string[]; logoUrl?: string; bannerUrl?: string; collegeId?: string; contactEmail: string; website?: string; privacy: 'PUBLIC' | 'PRIVATE' }) {
    this.active(actor);
    const existing = await ClubModel.findOne({ slug: input.slug.toLowerCase() }).exec();
    if (existing) throw new AppError('CONFLICT', 'A club with this slug already exists.', 409);
    const club = await ClubModel.create({ ...input, slug: input.slug.toLowerCase(), ownerId: objectId(actor.userId), status: 'PENDING' });
    return this.clubView(club, actor);
  }

  async update(actor: ClubActor, clubId: string, input: Partial<{ name: string; shortDescription?: string; description: string; category: string; tags: string[]; logoUrl?: string; bannerUrl?: string; collegeId?: string; contactEmail: string; website?: string; privacy: 'PUBLIC' | 'PRIVATE' }>) {
    this.active(actor);
    const club = await this.requireOwner(clubId, actor);
    Object.assign(club, input);
    await club.save();
    return this.clubView(club, actor);
  }

  async requestJoin(actor: ClubActor, clubId: string, message?: string) {
    this.active(actor);
    const club = await this.requireClub(clubId);
    if (club.status !== 'APPROVED') throw new AppError('CLUB_UNAVAILABLE', 'This club is not accepting members.', 409);
    if (await this.requireActiveMember(clubId, actor.userId)) throw new AppError('ALREADY_MEMBER', 'You are already a member of this club.', 409);
    const existing = await ClubJoinRequestModel.findOne({ clubId: club._id, userId: objectId(actor.userId), status: 'PENDING' }).exec();
    if (existing) throw new AppError('REQUEST_EXISTS', 'A join request is already pending.', 409);
    const request = await ClubJoinRequestModel.create({ clubId: club._id, userId: objectId(actor.userId), status: 'PENDING', ...(message ? { message } : {}) });
    return this.joinRequestView(request);
  }

  async listMembers(actor: ClubActor, clubId: string) {
    this.active(actor);
    const club = await this.requireClub(clubId);
    const member = await this.requireActiveMember(clubId, actor.userId);
    if (club.privacy === 'PRIVATE' && !member && club.ownerId.toString() !== actor.userId) throw new AppError('FORBIDDEN', 'Join the private club to view its members.', 403);
    const memberships = await ClubMembershipModel.find({ clubId: club._id, status: 'ACTIVE' }).sort({ role: 1, createdAt: 1 }).limit(100).exec();
    const users = await this.users.findByIds(memberships.map((item) => item.userId));
    const byId = new Map(users.map((user) => [user.id, user]));
    return { data: memberships.map((item) => ({ id: item.id, clubId: item.clubId.toString(), userId: item.userId.toString(), role: item.role, status: item.status, joinedAt: item.joinedAt?.toISOString(), user: byId.get(item.userId.toString()) ? { id: byId.get(item.userId.toString())!.id, username: byId.get(item.userId.toString())!.username, displayName: byId.get(item.userId.toString())!.displayName, ...(byId.get(item.userId.toString())!.avatarUrl ? { avatarUrl: byId.get(item.userId.toString())!.avatarUrl } : {}) } : undefined, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })), pagination: { hasMore: false, nextCursor: null } };
  }

  async listRequests(actor: ClubActor, clubId: string) {
    this.active(actor);
    await this.requireOwner(clubId, actor);
    const items = await ClubJoinRequestModel.find({ clubId: objectId(clubId), status: 'PENDING' }).sort({ createdAt: -1 }).limit(100).exec();
    return { data: items.map((item) => this.joinRequestView(item)), pagination: { hasMore: false, nextCursor: null } };
  }

  private joinRequestView(item: ClubJoinRequestDocument) {
    return { id: item.id, clubId: item.clubId.toString(), userId: item.userId.toString(), status: item.status, ...(item.message ? { message: item.message } : {}), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
  }

  async reviewRequest(actor: ClubActor, clubId: string, requestId: string, approve: boolean) {
    this.active(actor);
    await this.requireOwner(clubId, actor);
    const request = await ClubJoinRequestModel.findOne({ _id: objectId(requestId), clubId: objectId(clubId), status: 'PENDING' }).exec();
    if (!request) throw new AppError('RESOURCE_NOT_FOUND', 'The join request was not found.', 404);
    request.status = approve ? 'APPROVED' : 'REJECTED'; request.reviewedBy = objectId(actor.userId); request.reviewedAt = new Date(); await request.save();
    if (approve) await ClubMembershipModel.findOneAndUpdate({ clubId: request.clubId, userId: request.userId }, { $set: { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
    return this.joinRequestView(request);
  }

  async updateMemberRole(actor: ClubActor, clubId: string, userId: string, role: 'SECRETARY' | 'MEMBER') {
    this.active(actor); await this.requireOwner(clubId, actor);
    if (userId === actor.userId) throw new AppError('INVALID_OPERATION', 'The owner role cannot be changed here.', 409);
    const member = await ClubMembershipModel.findOne({ clubId: objectId(clubId), userId: objectId(userId), status: 'ACTIVE' }).exec();
    if (!member) throw new AppError('RESOURCE_NOT_FOUND', 'The club member was not found.', 404);
    member.role = role; await member.save(); return member;
  }

  async removeMember(actor: ClubActor, clubId: string, userId: string) {
    this.active(actor); await this.requireOwner(clubId, actor);
    if (userId === actor.userId) throw new AppError('INVALID_OPERATION', 'The owner cannot remove themselves.', 409);
    const member = await ClubMembershipModel.findOneAndUpdate({ clubId: objectId(clubId), userId: objectId(userId), status: 'ACTIVE' }, { $set: { status: 'REMOVED' } }, { new: true }).exec();
    if (!member) throw new AppError('RESOURCE_NOT_FOUND', 'The club member was not found.', 404);
    return undefined;
  }

  async invite(actor: ClubActor, clubId: string, inviteeId: string) {
    this.active(actor); await this.requireOwner(clubId, actor);
    if (inviteeId === actor.userId) throw new AppError('INVALID_OPERATION', 'You cannot invite yourself.', 409);
    if (!(await this.users.findById(inviteeId))) throw new AppError('RESOURCE_NOT_FOUND', 'The invited user was not found.', 404);
    if (await this.requireActiveMember(clubId, inviteeId)) throw new AppError('ALREADY_MEMBER', 'This user is already a club member.', 409);
    const existing = await ClubInvitationModel.findOne({ clubId: objectId(clubId), inviteeId: objectId(inviteeId), status: 'PENDING' }).exec();
    if (existing) throw new AppError('INVITATION_EXISTS', 'An invitation is already pending.', 409);
    return this.invitationView(await ClubInvitationModel.create({ clubId: objectId(clubId), inviterId: objectId(actor.userId), inviteeId: objectId(inviteeId), status: 'PENDING' }));
  }

  async listInvitations(actor: ClubActor) {
    this.active(actor);
    const items = await ClubInvitationModel.find({ inviteeId: objectId(actor.userId), status: 'PENDING' }).sort({ createdAt: -1 }).limit(50).exec();
    return { data: await Promise.all(items.map((item) => this.invitationView(item))), pagination: { hasMore: false, nextCursor: null } };
  }

  private async invitationView(item: ClubInvitationDocument) {
    const club = await ClubModel.findById(item.clubId).exec();
    return { id: item.id, clubId: item.clubId.toString(), inviterId: item.inviterId.toString(), inviteeId: item.inviteeId.toString(), status: item.status, ...(club ? { club: { id: club.id, name: club.name, slug: club.slug, category: club.category, privacy: club.privacy, status: club.status, ...(club.logoUrl ? { logoUrl: club.logoUrl } : {}) } } : {}), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
  }

  async respondInvitation(actor: ClubActor, invitationId: string, accept: boolean) {
    this.active(actor);
    const invitation = await ClubInvitationModel.findOne({ _id: objectId(invitationId), inviteeId: objectId(actor.userId), status: 'PENDING' }).exec();
    if (!invitation) throw new AppError('RESOURCE_NOT_FOUND', 'The club invitation was not found.', 404);
    const club = await this.requireClub(invitation.clubId.toString());
    invitation.status = accept ? 'ACCEPTED' : 'REJECTED'; await invitation.save();
    if (accept && club.status === 'APPROVED') await ClubMembershipModel.findOneAndUpdate({ clubId: club._id, userId: objectId(actor.userId) }, { $set: { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
    return this.invitationView(invitation);
  }

  private eventStatus(event: EventDocument) {
    if (event.status === 'CANCELLED' || event.status === 'ARCHIVED') return event.status;
    const now = Date.now(); if (now < event.startAt.valueOf()) return 'UPCOMING' as const; if (now < event.endAt.valueOf()) return 'ONGOING' as const; return 'COMPLETED' as const;
  }

  private async eventView(event: EventDocument) {
    const user = await this.users.findById(event.createdBy?.toString() ?? event.organizerId.toString());
    return { id: event.id, title: event.title, description: event.description, organizerId: event.organizerId.toString(), ...(user ? { organizer: { id: user.id, username: user.username, displayName: user.displayName, ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}) } } : {}), category: event.category, tags: event.tags ?? [], ...(event.coverImageUrl ? { coverImageUrl: event.coverImageUrl } : {}), ...(event.venue ? { venue: event.venue } : {}), mode: event.mode, ...(event.meetingLink ? { meetingLink: event.meetingLink } : {}), startAt: event.startAt.toISOString(), endAt: event.endAt.toISOString(), ...(event.registrationDeadline ? { registrationDeadline: event.registrationDeadline.toISOString() } : {}), ...(event.registrationUrl ? { registrationUrl: event.registrationUrl } : {}), ...(event.capacity !== undefined ? { capacity: event.capacity, availableSeats: Math.max(0, event.capacity - event.registrationCount) } : {}), registrationCount: event.registrationCount, visibility: event.visibility, status: this.eventStatus(event), registrationRequired: event.registrationRequired, rules: event.rules ?? [], organizerClubId: event.organizerClub?.toString(), createdBy: event.createdBy?.toString(), createdAt: event.createdAt.toISOString(), updatedAt: event.updatedAt.toISOString() };
  }

  async createEvent(actor: ClubActor, clubId: string, input: { title: string; description: string; category: string; tags: string[]; coverImageUrl?: string; venue?: string; mode: EventMode; meetingLink?: string; startAt: string; endAt: string; registrationDeadline?: string; registrationUrl?: string; capacity?: number; registrationRequired: boolean; visibility: EventVisibility; rules: string[] }) {
    this.active(actor); const { club } = await this.requireEventManager(clubId, actor);
    const start = new Date(input.startAt); const end = new Date(input.endAt);
    if (start <= new Date() || end <= start) throw new AppError('INVALID_EVENT_TIME', 'Event times must be valid and in the future.', 422);
    if (input.registrationRequired && !input.registrationUrl) throw new AppError('REGISTRATION_URL_REQUIRED', 'An external registration URL is required for this event.', 422);
    if (input.registrationDeadline && new Date(input.registrationDeadline) >= start) throw new AppError('INVALID_REGISTRATION_DEADLINE', 'Registration must close before the event starts.', 422);
    if ((input.mode === 'OFFLINE' || input.mode === 'HYBRID') && !input.venue?.trim()) throw new AppError('VENUE_REQUIRED', 'Venue is required for offline or hybrid events.', 422);
    if ((input.mode === 'ONLINE' || input.mode === 'HYBRID') && !input.meetingLink?.trim()) throw new AppError('MEETING_LINK_REQUIRED', 'Meeting link is required for online or hybrid events.', 422);
    const event = await EventModel.create({ ...input, organizerId: objectId(actor.userId), organizerClub: club._id, createdBy: objectId(actor.userId), status: 'UPCOMING', registrationCount: 0, startAt: start, endAt: end, ...(input.registrationDeadline ? { registrationDeadline: new Date(input.registrationDeadline) } : {}) });
    return this.eventView(event);
  }

  async listEvents(actor: ClubActor, clubId: string) {
    this.active(actor); const club = await this.requireClub(clubId); const member = await this.requireActiveMember(clubId, actor.userId);
    if (club.privacy === 'PRIVATE' && !member && club.ownerId.toString() !== actor.userId) throw new AppError('FORBIDDEN', 'Join the private club to view its events.', 403);
    const events = await EventModel.find({ organizerClub: club._id, status: { $ne: 'ARCHIVED' } }).sort({ startAt: 1, _id: 1 }).limit(50).exec();
    return { data: await Promise.all(events.map((event) => this.eventView(event))), pagination: { hasMore: false, nextCursor: null } };
  }

  async adminList(status?: ClubStatus) {
    const items = await ClubModel.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(100).exec();
    return { data: items.map((club) => ({ id: club.id, name: club.name, slug: club.slug, category: club.category, privacy: club.privacy, status: club.status, ownerId: club.ownerId.toString(), description: club.description, contactEmail: club.contactEmail, rejectionReason: club.rejectionReason, createdAt: club.createdAt.toISOString(), updatedAt: club.updatedAt.toISOString() })), pagination: { hasMore: false, nextCursor: null } };
  }

  async adminReview(_adminId: string, clubId: string, status: Exclude<ClubStatus, 'PENDING'>, reason?: string) {
    const club = await this.requireClub(clubId);
    club.status = status;
    if (status === 'REJECTED' && reason) club.rejectionReason = reason;
    else club.set('rejectionReason', undefined);
    await club.save();
    if (status === 'APPROVED') await ClubMembershipModel.findOneAndUpdate({ clubId: club._id, userId: club.ownerId }, { $set: { role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
    return this.adminList(status);
  }
}

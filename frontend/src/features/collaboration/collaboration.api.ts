import type {
  ApiCollection,
  CommunityMembershipView,
  CommunityView,
  MilestoneView,
  ProjectActivityView,
  ProjectInvitationView,
  ProjectJoinRequestView,
  ProjectMembershipView,
  ProjectResourceView,
  ProjectView,
  EventRegistrationStatus,
  EventRegistrationView,
  EventView,
  TaskStatus,
  TaskView,
  TeamInvitationView,
  TeamInvitationPreviewView,
  TeamJoinRequestView,
  TeamMembershipView,
  TeamView,
} from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';
export const getCommunities = () =>
  apiRequest<ApiCollection<CommunityView>>('/communities?limit=20');
export const createCommunity = (input: Record<string, unknown>) =>
  apiRequest<CommunityView>('/communities', { method: 'POST', body: JSON.stringify(input) });
export const joinCommunity = (id: string) =>
  apiRequest<CommunityMembershipView>(`/communities/${id}/join`, { method: 'POST' });
export const leaveCommunity = (id: string) =>
  apiRequest<void>(`/communities/${id}/leave`, { method: 'POST' });
export const getCommunityMembers = (id: string) =>
  apiRequest<ApiCollection<CommunityMembershipView>>(`/communities/${id}/members?limit=20`);
export const getTeams = (
  params: { search?: string; category?: string; tags?: string; available?: boolean } = {},
) => {
  const query = new URLSearchParams({ limit: '20' });
  if (params.search) query.set('search', params.search);
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.tags) query.set('tags', params.tags);
  if (params.available) query.set('available', 'true');
  return apiRequest<ApiCollection<TeamView>>(`/teams?${query.toString()}`);
};
export const createTeam = (input: Record<string, unknown>) =>
  apiRequest<TeamView>('/teams', { method: 'POST', body: JSON.stringify(input) });
export const getTeam = (id: string) => apiRequest<TeamView>(`/teams/${id}`);
export const getTeamInvitationPreview = (id: string) =>
  apiRequest<TeamInvitationPreviewView>(`/teams/${id}/invitation-preview`);
export const updateTeam = (id: string, input: Record<string, unknown>) =>
  apiRequest<TeamView>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const joinTeam = (id: string) =>
  apiRequest<TeamMembershipView>(`/teams/${id}/join`, { method: 'POST' });
export const leaveTeam = (id: string) => apiRequest<void>(`/teams/${id}/leave`, { method: 'POST' });
export const removeTeamMember = (teamId: string, userId: string) =>
  apiRequest<void>(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
export const getTeamMembers = (id: string) =>
  apiRequest<ApiCollection<TeamMembershipView>>(`/teams/${id}/members?limit=20`);
export const inviteTeamMember = (id: string, inviteeId: string) =>
  apiRequest<TeamInvitationView>(`/teams/${id}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ inviteeId }),
  });
export const getTeamJoinRequests = (id: string) =>
  apiRequest<ApiCollection<TeamJoinRequestView>>(`/teams/${id}/requests?limit=50`);
export const reviewTeamJoinRequest = (teamId: string, requestId: string, approve: boolean) =>
  apiRequest(`/teams/${teamId}/requests/${requestId}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
  });
export const updateTeamMemberRole = (teamId: string, userId: string, role: 'CO_LEAD' | 'MEMBER') =>
  apiRequest<TeamMembershipView>(`/teams/${teamId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
export const transferTeamOwnership = (teamId: string, userId: string) =>
  apiRequest<TeamView>(`/teams/${teamId}/transfer-ownership`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
export const completeTeam = (teamId: string) =>
  apiRequest<TeamView>(`/teams/${teamId}/complete`, { method: 'POST' });
export const archiveTeam = (teamId: string) =>
  apiRequest<void>(`/teams/${teamId}/archive`, { method: 'POST' });
export const getTeamInvitations = () =>
  apiRequest<ApiCollection<TeamInvitationView>>('/team-invitations?limit=50');
export const respondToTeamInvitation = (invitationId: string, accept: boolean) =>
  apiRequest<TeamInvitationView>(
    `/team-invitations/${invitationId}/${accept ? 'accept' : 'reject'}`,
    { method: 'POST' },
  );
export const getProjects = (
  params: { search?: string; category?: string; tags?: string; status?: string } = {},
) => {
  const query = new URLSearchParams({ limit: '20' });
  if (params.search) query.set('search', params.search);
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.tags) query.set('tags', params.tags);
  if (params.status && params.status !== 'All') query.set('status', params.status.toUpperCase());
  return apiRequest<ApiCollection<ProjectView>>(`/projects?${query.toString()}`);
};
export const createProject = (input: Record<string, unknown>) =>
  apiRequest<ProjectView>('/projects', { method: 'POST', body: JSON.stringify(input) });
export const getProject = (id: string) => apiRequest<ProjectView>(`/projects/${id}`);
export const updateProject = (id: string, input: Record<string, unknown>) =>
  apiRequest<ProjectView>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const archiveProject = (id: string) =>
  apiRequest<void>(`/projects/${id}`, { method: 'DELETE' });
export const completeProject = (id: string) =>
  apiRequest<ProjectView>(`/projects/${id}/complete`, { method: 'POST' });
export const activateProject = (id: string) =>
  apiRequest<ProjectView>(`/projects/${id}/activate`, { method: 'POST' });
export const joinProject = (id: string, message?: string) =>
  apiRequest(`/projects/${id}/join`, {
    method: 'POST',
    body: JSON.stringify(message ? { message } : {}),
  });
export const leaveProject = (id: string) =>
  apiRequest<void>(`/projects/${id}/leave`, { method: 'POST' });
export const getProjectMembers = (id: string) =>
  apiRequest<ApiCollection<ProjectMembershipView>>(`/projects/${id}/members?limit=20`);
export const removeProjectMember = (projectId: string, userId: string) =>
  apiRequest<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
export const transferProjectOwnership = (projectId: string, userId: string) =>
  apiRequest<ProjectView>(`/projects/${projectId}/transfer-ownership`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
export const getProjectJoinRequests = (id: string) =>
  apiRequest<ApiCollection<ProjectJoinRequestView>>(`/projects/${id}/requests?limit=50`);
export const reviewProjectJoinRequest = (projectId: string, requestId: string, approve: boolean) =>
  apiRequest(`/projects/${projectId}/requests/${requestId}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
  });
export const inviteProjectMember = (projectId: string, inviteeId: string) =>
  apiRequest<ProjectInvitationView>(`/projects/${projectId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ inviteeId }),
  });
export const getProjectInvitations = () =>
  apiRequest<ApiCollection<ProjectInvitationView>>('/project-invitations?limit=50');
export const respondToProjectInvitation = (invitationId: string, accept: boolean) =>
  apiRequest<ProjectInvitationView>(
    `/project-invitations/${invitationId}/${accept ? 'accept' : 'decline'}`,
    { method: 'POST' },
  );
export const getEvents = (
  params: {
    search?: string;
    category?: string;
    tags?: string;
    status?: string;
    mode?: string;
    from?: string;
    to?: string;
    available?: boolean;
  } = {},
) => {
  const query = new URLSearchParams({ limit: '20' });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== false && value !== 'All')
      query.set(key, String(value));
  });
  return apiRequest<ApiCollection<EventView>>(`/events?${query.toString()}`);
};
export const getEvent = (id: string) => apiRequest<EventView>(`/events/${id}`);
export const createEvent = (input: Record<string, unknown>) =>
  apiRequest<EventView>('/events', { method: 'POST', body: JSON.stringify(input) });
export const updateEvent = (id: string, input: Record<string, unknown>) =>
  apiRequest<EventView>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const archiveEvent = (id: string) => apiRequest<void>(`/events/${id}`, { method: 'DELETE' });
export const cancelEvent = (id: string) =>
  apiRequest<EventView>(`/events/${id}/cancel`, { method: 'POST' });
export const registerForEvent = (id: string) =>
  apiRequest<EventView>(`/events/${id}/register`, { method: 'POST' });
export const cancelEventRegistration = (id: string) =>
  apiRequest<EventView>(`/events/${id}/cancel-registration`, { method: 'POST' });
export const getEventRegistrations = (id: string) =>
  apiRequest<ApiCollection<EventRegistrationView>>(`/events/${id}/registrations?limit=50`);
export const updateEventRegistration = (
  eventId: string,
  registrationId: string,
  status: EventRegistrationStatus,
) =>
  apiRequest<EventRegistrationView>(`/events/${eventId}/registrations/${registrationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
export const getTasks = (id: string) =>
  apiRequest<ApiCollection<TaskView>>(`/projects/${id}/tasks?limit=20`);
export const createTask = (id: string, input: Record<string, unknown>) =>
  apiRequest<TaskView>(`/projects/${id}/tasks`, { method: 'POST', body: JSON.stringify(input) });
export const updateTask = (id: string, input: Record<string, unknown>) =>
  apiRequest<TaskView>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const deleteTask = (id: string) => apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' });
export const assignTask = (id: string, assigneeId: string) =>
  apiRequest<TaskView>(`/tasks/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assigneeId }),
  });
export const updateTaskStatus = (id: string, status: TaskStatus) =>
  apiRequest<TaskView>(`/tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
export const getMilestones = (id: string) =>
  apiRequest<{ data: MilestoneView[] }>('/projects/' + id + '/milestones');
export const createMilestone = (id: string, input: Record<string, unknown>) =>
  apiRequest<MilestoneView>(`/projects/${id}/milestones`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateMilestone = (id: string, input: Record<string, unknown>) =>
  apiRequest<MilestoneView>(`/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const deleteMilestone = (id: string) =>
  apiRequest<void>(`/milestones/${id}`, { method: 'DELETE' });
export const getProjectResources = (id: string) =>
  apiRequest<{ data: ProjectResourceView[] }>(`/projects/${id}/resources`);
export const createProjectResource = (id: string, input: Record<string, unknown>) =>
  apiRequest<ProjectResourceView>(`/projects/${id}/resources`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateProjectResource = (
  projectId: string,
  resourceId: string,
  input: Record<string, unknown>,
) =>
  apiRequest<ProjectResourceView>(`/projects/${projectId}/resources/${resourceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const deleteProjectResource = (projectId: string, resourceId: string) =>
  apiRequest<void>(`/projects/${projectId}/resources/${resourceId}`, { method: 'DELETE' });
export const getProjectActivity = (id: string) =>
  apiRequest<{ data: ProjectActivityView[] }>(`/projects/${id}/activity`);
export const postProjectUpdate = (id: string, message: string) =>
  apiRequest<ProjectActivityView>(`/projects/${id}/updates`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });

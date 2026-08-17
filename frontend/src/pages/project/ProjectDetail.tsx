import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage, collectionItems } from '../../lib/api-state';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  TextareaField,
} from '../../components/ui';
import {
  activateProject,
  archiveProject,
  assignTask,
  completeProject,
  createMilestone,
  createProjectResource,
  createTask,
  deleteMilestone,
  deleteProjectResource,
  deleteTask,
  getMilestones,
  getProject,
  getProjectActivity,
  getProjectInvitations,
  getProjectJoinRequests,
  getProjectMembers,
  getProjectResources,
  getTasks,
  inviteProjectMember,
  joinProject,
  leaveProject,
  postProjectUpdate,
  removeProjectMember,
  respondToProjectInvitation,
  reviewProjectJoinRequest,
  transferProjectOwnership,
  updateMilestone,
  updateProject,
  updateTask,
  updateTaskStatus,
} from '../../features/collaboration/collaboration.api';

type ProjectTab = 'overview' | 'tasks' | 'milestones' | 'resources' | 'activity' | 'manage';

export function ProjectDetail({
  projectId,
  onNavigate,
}: {
  projectId: string;
  onNavigate: (target: string) => void;
}) {
  const client = useQueryClient();
  const [tab, setTab] = useState<ProjectTab>('overview');
  const [inviteeId, setInviteeId] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editObjective, setEditObjective] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState('REPOSITORY');
  const [updateMessage, setUpdateMessage] = useState('');
  const project = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });
  const members = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => getProjectMembers(projectId),
    enabled: Boolean(project.data?.isMember || project.data?.membershipRole === 'OWNER'),
  });
  const tasks = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => getTasks(projectId),
    enabled: Boolean(project.data?.isMember),
  });
  const projectMilestones = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => getMilestones(projectId),
    enabled: Boolean(project.data?.isMember),
  });
  const resources = useQuery({
    queryKey: ['project-resources', projectId],
    queryFn: () => getProjectResources(projectId),
    enabled: Boolean(project.data?.isMember),
  });
  const activity = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => getProjectActivity(projectId),
    enabled: Boolean(project.data?.isMember),
  });
  const requests = useQuery({
    queryKey: ['project-requests', projectId],
    queryFn: () => getProjectJoinRequests(projectId),
    enabled: tab === 'manage',
  });
  const invitations = useQuery({
    queryKey: ['project-invitations'],
    queryFn: getProjectInvitations,
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['project', projectId] });
    void client.invalidateQueries({ queryKey: ['project-members', projectId] });
    void client.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    void client.invalidateQueries({ queryKey: ['milestones', projectId] });
    void client.invalidateQueries({ queryKey: ['project-resources', projectId] });
    void client.invalidateQueries({ queryKey: ['project-activity', projectId] });
    void client.invalidateQueries({ queryKey: ['project-requests', projectId] });
    void client.invalidateQueries({ queryKey: ['projects'] });
  };
  const membership = useMutation({
    mutationFn: async (leave: boolean) => {
      if (leave) await leaveProject(projectId);
      else await joinProject(projectId);
    },
    onSuccess: refresh,
  });
  const edit = useMutation({
    mutationFn: () =>
      updateProject(projectId, {
        name: editName.trim() || item.name,
        description: editDescription.trim() || item.description,
        objective: editObjective.trim() || item.objective || 'Project objective',
        category: item.category ?? 'Technology',
        tags: item.tags ?? [],
        technologies: item.technologies,
        lookingFor: item.lookingFor ?? [],
        visibility: item.visibility,
      }),
    onSuccess: refresh,
  });
  const activate = useMutation({
    mutationFn: () => activateProject(projectId),
    onSuccess: refresh,
  });
  const complete = useMutation({
    mutationFn: () => completeProject(projectId),
    onSuccess: refresh,
  });
  const archive = useMutation({
    mutationFn: () => archiveProject(projectId),
    onSuccess: () => onNavigate('/projects'),
  });
  const invite = useMutation({
    mutationFn: () => inviteProjectMember(projectId, inviteeId.trim()),
    onSuccess: () => {
      setInviteeId('');
      refresh();
    },
  });
  const transfer = useMutation({
    mutationFn: () => transferProjectOwnership(projectId, transferUserId.trim()),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId, userId),
    onSuccess: refresh,
  });
  const requestReview = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewProjectJoinRequest(projectId, id, approve),
    onSuccess: refresh,
  });
  const taskCreate = useMutation({
    mutationFn: () =>
      createTask(projectId, {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
      }),
    onSuccess: () => {
      setTaskTitle('');
      setTaskDescription('');
      refresh();
    },
  });
  const taskStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'TODO' | 'IN_PROGRESS' | 'DONE' }) =>
      updateTaskStatus(id, status),
    onSuccess: refresh,
  });
  const taskEdit = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      updateTask(id, input),
    onSuccess: refresh,
  });
  const taskRemove = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: refresh,
  });
  const assign = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => assignTask(id, userId),
    onSuccess: refresh,
  });
  const milestoneCreate = useMutation({
    mutationFn: () =>
      createMilestone(projectId, {
        title: milestoneTitle.trim(),
        description: '',
        order: collectionItems(projectMilestones.data).length,
        status: 'UPCOMING',
      }),
    onSuccess: () => {
      setMilestoneTitle('');
      refresh();
    },
  });
  const milestoneEdit = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
    }) => updateMilestone(id, { status }),
    onSuccess: refresh,
  });
  const milestoneRemove = useMutation({
    mutationFn: (id: string) => deleteMilestone(id),
    onSuccess: refresh,
  });
  const resourceCreate = useMutation({
    mutationFn: () =>
      createProjectResource(projectId, {
        title: resourceTitle.trim(),
        url: resourceUrl.trim(),
        type: resourceType,
      }),
    onSuccess: () => {
      setResourceTitle('');
      setResourceUrl('');
      refresh();
    },
  });
  const resourceRemove = useMutation({
    mutationFn: (id: string) => deleteProjectResource(projectId, id),
    onSuccess: refresh,
  });
  const postUpdate = useMutation({
    mutationFn: () => postProjectUpdate(projectId, updateMessage.trim()),
    onSuccess: () => {
      setUpdateMessage('');
      refresh();
    },
  });
  const invitation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondToProjectInvitation(id, accept),
    onSuccess: refresh,
  });

  if (project.isLoading) return <LoadingState label="Opening project" />;
  if (project.error || !project.data)
    return <ErrorState message={apiErrorMessage(project.error, 'Project not found.')} />;
  const item = project.data;
  const isOwner = item.membershipRole === 'OWNER';
  const isMember = Boolean(item.isMember || isOwner);
  const membersList = collectionItems(members.data);
  const taskList = collectionItems(tasks.data);
  const milestoneList = collectionItems(projectMilestones.data);
  const resourceList = resources.data?.data ?? [];
  const activityList = activity.data?.data ?? [];
  const allError =
    membership.error ??
    edit.error ??
    activate.error ??
    complete.error ??
    archive.error ??
    invite.error ??
    transfer.error ??
    remove.error ??
    requestReview.error ??
    taskCreate.error ??
    taskStatus.error ??
    taskEdit.error ??
    taskRemove.error ??
    assign.error ??
    milestoneCreate.error ??
    milestoneEdit.error ??
    milestoneRemove.error ??
    resourceCreate.error ??
    resourceRemove.error ??
    postUpdate.error ??
    invitation.error;

  return (
    <div className="page-theme page-theme-projects space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-brand-800 px-5 py-7 text-white sm:px-8">
          <button
            type="button"
            onClick={() => onNavigate('/projects')}
            className="mb-6 text-sm font-semibold text-white/80 hover:text-white"
          >
            ← Projects
          </button>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">{item.category ?? 'Project'}</Badge>
                <Badge tone="neutral">{item.status}</Badge>
                <Badge tone="neutral">{item.visibility}</Badge>
              </div>
              <h1 className="type-display mt-3 text-3xl font-bold">{item.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">{item.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.membershipStatus === 'PENDING' ? (
                <Button size="sm" variant="secondary" disabled>
                  Request pending
                </Button>
              ) : isMember ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isOwner || membership.isPending}
                  onClick={() => membership.mutate(true)}
                >
                  {isOwner ? 'Transfer ownership to leave' : 'Leave project'}
                </Button>
              ) : item.status === 'COMPLETED' || item.status === 'ARCHIVED' ? (
                <Button size="sm" variant="secondary" disabled>
                  {item.status}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => membership.mutate(false)}>
                  {item.visibility === 'PRIVATE' ? 'Request to join' : 'Join project'}
                </Button>
              )}
              {isOwner ? (
                <Button size="sm" onClick={() => setTab('manage')}>
                  Manage
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5 px-5 py-4 text-xs font-semibold text-muted sm:px-8">
          <span>{item.progressPercent ?? 0}% complete</span>
          <span>{item.memberCount ?? 0} collaborators</span>
          {item.deadline ? <span>Due {new Date(item.deadline).toLocaleDateString()}</span> : null}
        </div>
      </Card>
      {allError ? (
        <ErrorState message={apiErrorMessage(allError, 'Project action could not be completed.')} />
      ) : null}
      <div
        className="flex gap-2 overflow-x-auto border-b border-line pb-2"
        role="tablist"
        aria-label="Project sections"
      >
        {(
          [
            'overview',
            'tasks',
            'milestones',
            'resources',
            'activity',
            ...(isOwner ? ['manage'] : []),
          ] as ProjectTab[]
        ).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            onClick={() => setTab(entry)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold capitalize ${tab === entry ? 'bg-brand-50 text-brand-700' : 'text-muted hover:text-brand-700'}`}
          >
            {entry}
          </button>
        ))}
      </div>
      {tab === 'overview' ? (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="space-y-5 p-5">
            <h2 className="type-display text-xl font-bold text-ink">Project overview</h2>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Objective</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {item.objective ?? 'Build something useful for campus.'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Description</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{item.description}</p>
            </div>
            <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Category</p>
                <p className="mt-1 text-sm font-semibold text-ink">{item.category ?? 'Project'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Tech stack</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {item.technologies.length ? item.technologies.join(' · ') : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Deadline</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'Open-ended'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.tags?.length ? (
                  item.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)
                ) : (
                  <span className="text-sm text-muted">No tags added.</span>
                )}
              </div>
            </div>
            {item.teamId || item.ownerTeamId ? (
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
                  Built by Team
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate(`/teams/${item.teamId ?? item.ownerTeamId}`)}
                >
                  Open associated team
                </Button>
              </div>
            ) : null}
          </Card>
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">
              Collaborators · {item.memberCount ?? membersList.length}
            </h2>
            <div className="mt-4 space-y-2">
              {membersList.slice(0, 6).map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <Avatar
                    name={member.user?.displayName ?? member.userId}
                    src={member.user?.avatarUrl}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-bold text-ink">
                      {member.user?.displayName ?? member.userId}
                    </p>
                    <p className="text-xs text-muted">{member.role}</p>
                  </div>
                </div>
              ))}
              {!membersList.length ? (
                <p className="text-sm text-muted">Join this project to see collaborators.</p>
              ) : null}
            </div>
          </Card>
        </section>
      ) : null}
      {tab === 'tasks' ? (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="type-display text-xl font-bold text-ink">Tasks</h2>
            <Badge tone="brand">{item.progressPercent ?? 0}% complete</Badge>
          </div>
          {isMember ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] ">
              <Field
                label="Title"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Build API"
              />
              <Field
                label="Description"
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                placeholder="Task details"
              />
              <select
                aria-label="Task priority"
                value={taskPriority}
                onChange={(event) => setTaskPriority(event.target.value)}
                className="self-end rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
              >
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
              </select>
              <Button
                className="self-end"
                onClick={() => taskCreate.mutate()}
                disabled={!taskTitle.trim() || taskCreate.isPending || item.status === 'COMPLETED'}
              >
                Add Task
              </Button>
            </div>
          ) : (
            <EmptyState
              title="Join to work on tasks"
              description="Project collaborators can create and update work."
            />
          )}
          {tasks.isLoading ? <LoadingState label="Loading tasks" /> : null}
          <div className="mt-5 space-y-3">
            {taskList.map((task) => (
              <div key={task.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{task.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {task.description || 'No description.'}
                    </p>
                  </div>
                  <Badge tone={task.status === 'DONE' ? 'success' : 'neutral'}>{task.status}</Badge>
                  <Badge>{task.priority}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    onChange={(event) =>
                      taskStatus.mutate({
                        id: task.id,
                        status: event.target.value as 'TODO' | 'IN_PROGRESS' | 'DONE',
                      })
                    }
                    className="rounded-lg border border-line bg-white px-2 py-2 text-xs"
                  >
                    <option>TODO</option>
                    <option>IN_PROGRESS</option>
                    <option>DONE</option>
                  </select>
                  {isOwner ? (
                    <>
                      <select
                        aria-label={`Assignee for ${task.title}`}
                        value={task.assigneeId ?? ''}
                        onChange={(event) =>
                          event.target.value &&
                          assign.mutate({ id: task.id, userId: event.target.value })
                        }
                        className="rounded-lg border border-line bg-white px-2 py-2 text-xs"
                      >
                        <option value="">Assign collaborator</option>
                        {membersList
                          .filter((member) => member.role !== 'OWNER')
                          .map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.user?.displayName ?? member.userId}
                            </option>
                          ))}
                      </select>
                      <Button size="sm" variant="ghost" onClick={() => taskRemove.mutate(task.id)}>
                        Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {!taskList.length ? (
              <EmptyState
                title="No tasks yet"
                description="Create the first task for this project."
              />
            ) : null}
          </div>
        </Card>
      ) : null}
      {tab === 'milestones' ? (
        <Card className="p-5">
          <h2 className="type-display text-xl font-bold text-ink">Milestones</h2>
          {isOwner ? (
            <div className="mt-4 flex gap-2">
              <Field
                className="flex-1"
                label="Milestone title"
                value={milestoneTitle}
                onChange={(event) => setMilestoneTitle(event.target.value)}
                placeholder="MVP design"
              />
              <Button
                className="self-end"
                onClick={() => milestoneCreate.mutate()}
                disabled={!milestoneTitle.trim() || milestoneCreate.isPending}
              >
                Add milestone
              </Button>
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {milestoneList.map((milestone) => (
              <div
                key={milestone.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4"
              >
                <span
                  className={`h-3 w-3 rounded-full ${milestone.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-brand-500'}`}
                />
                <span className="mr-auto font-semibold text-ink">{milestone.title}</span>
                <select
                  aria-label={`Status for ${milestone.title}`}
                  value={milestone.status}
                  onChange={(event) =>
                    milestoneEdit.mutate({
                      id: milestone.id,
                      status: event.target.value as 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED',
                    })
                  }
                  className="rounded-lg border border-line bg-white px-2 py-2 text-xs"
                >
                  <option>UPCOMING</option>
                  <option>IN_PROGRESS</option>
                  <option>COMPLETED</option>
                </select>
                {isOwner ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => milestoneRemove.mutate(milestone.id)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            ))}
            {!milestoneList.length ? (
              <EmptyState
                title="No milestones yet"
                description="Add milestones to track meaningful project outcomes."
              />
            ) : null}
          </div>
        </Card>
      ) : null}
      {tab === 'resources' ? (
        <Card className="p-5">
          <h2 className="type-display text-xl font-bold text-ink">Resources</h2>
          {isMember ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <Field
                label="Title"
                value={resourceTitle}
                onChange={(event) => setResourceTitle(event.target.value)}
                placeholder="GitHub repository"
              />
              <Field
                label="URL"
                value={resourceUrl}
                onChange={(event) => setResourceUrl(event.target.value)}
                placeholder="https://..."
              />
              <select
                aria-label="Resource type"
                value={resourceType}
                onChange={(event) => setResourceType(event.target.value)}
                className="self-end rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
              >
                <option>REPOSITORY</option>
                <option>DEMO</option>
                <option>DOCUMENTATION</option>
                <option>DESIGN</option>
                <option>OTHER</option>
              </select>
              <Button
                className="self-end"
                onClick={() => resourceCreate.mutate()}
                disabled={!resourceTitle.trim() || !resourceUrl.trim()}
              >
                Add
              </Button>
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {resourceList.map((resource) => (
              <div key={resource.id} className="rounded-xl border border-line p-4">
                <p className="font-bold text-ink">{resource.title}</p>
                <Badge tone="neutral">{resource.type}</Badge>
                <a
                  className="mt-2 block truncate text-sm text-brand-700 underline"
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {resource.url}
                </a>
                {isOwner ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => resourceRemove.mutate(resource.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            {!resourceList.length ? (
              <EmptyState
                title="No resources added yet"
                description="Add repositories, demos, documentation, and design links."
              />
            ) : null}
          </div>
        </Card>
      ) : null}
      {tab === 'activity' ? (
        <Card className="p-5">
          <h2 className="type-display text-xl font-bold text-ink">Project activity</h2>
          {isMember ? (
            <div className="mt-4 flex gap-2">
              <TextareaField
                className="flex-1"
                label="Project update"
                value={updateMessage}
                onChange={(event) => setUpdateMessage(event.target.value)}
                placeholder="Share what the project completed or is working on."
              />
              <Button
                className="self-end"
                onClick={() => postUpdate.mutate()}
                disabled={!updateMessage.trim() || postUpdate.isPending}
              >
                Post update
              </Button>
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {activityList.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-700">{entry.message}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {!activityList.length ? (
              <EmptyState
                title="No activity yet"
                description="Project updates and work history will appear here."
              />
            ) : null}
          </div>
        </Card>
      ) : null}
      {tab === 'manage' && isOwner ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Project settings</h2>
            <div className="mt-4 grid gap-3">
              <Field
                label="Name"
                value={editName || item.name}
                onChange={(event) => setEditName(event.target.value)}
              />
              <TextareaField
                label="Description"
                value={editDescription || item.description}
                onChange={(event) => setEditDescription(event.target.value)}
              />
              <TextareaField
                label="Objective"
                value={editObjective || item.objective || ''}
                onChange={(event) => setEditObjective(event.target.value)}
              />
              <Button
                onClick={() => edit.mutate()}
                disabled={edit.isPending || item.status === 'COMPLETED'}
              >
                Save changes
              </Button>
              <div className="flex flex-wrap gap-2">
                {item.status === 'PLANNING' ? (
                  <Button
                    variant="secondary"
                    onClick={() => activate.mutate()}
                    disabled={activate.isPending}
                  >
                    Activate project
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => complete.mutate()}
                    disabled={complete.isPending || item.status !== 'ACTIVE'}
                  >
                    Complete project
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => archive.mutate()}
                  disabled={archive.isPending}
                >
                  Archive project
                </Button>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Invite collaborators</h2>
            <div className="mt-4 flex gap-2">
              <Field
                className="flex-1"
                label="User ID"
                value={inviteeId}
                onChange={(event) => setInviteeId(event.target.value)}
                placeholder="Paste a student user id"
              />
              <Button
                className="self-end"
                onClick={() => invite.mutate()}
                disabled={!inviteeId.trim()}
              >
                Invite
              </Button>
            </div>
            <h3 className="mt-6 font-bold text-ink">Join requests</h3>
            <div className="mt-3 space-y-2">
              {collectionItems(requests.data).map((request) => (
                <div key={request.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-ink">{request.userId}</p>
                  <p className="text-xs text-muted">{request.message ?? 'Requested to join.'}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => requestReview.mutate({ id: request.id, approve: true })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => requestReview.mutate({ id: request.id, approve: false })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Transfer ownership</h2>
            <div className="mt-4 flex gap-2">
              <Field
                className="flex-1"
                label="Collaborator user ID"
                value={transferUserId}
                onChange={(event) => setTransferUserId(event.target.value)}
                placeholder="Paste a collaborator user id"
              />
              <Button
                className="self-end"
                variant="secondary"
                onClick={() => transfer.mutate()}
                disabled={!transferUserId.trim()}
              >
                Transfer
              </Button>
            </div>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h2 className="type-display text-lg font-bold text-ink">Manage collaborators</h2>
            <div className="mt-4 space-y-2">
              {membersList.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <span className="mr-auto text-sm font-semibold text-ink">
                    {member.user?.displayName ?? member.userId} · {member.role}
                  </span>
                  {member.role !== 'OWNER' ? (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(member.userId)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}
      {item.status === 'COMPLETED' ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ✓ COMPLETED — project history remains available to collaborators.
        </Card>
      ) : null}
      {item.status === 'ARCHIVED' ? (
        <Card className="bg-slate-100 p-4 text-sm font-semibold text-slate-700">
          ARCHIVED — this project is preserved as historical work.
        </Card>
      ) : null}
      {invitations.data?.data?.length ? (
        <Card className="p-5">
          <h2 className="type-display text-lg font-bold text-ink">Project invitations</h2>
          {invitations.data.data.map((entry) => (
            <div
              key={entry.id}
              className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3"
            >
              <span className="mr-auto text-sm font-semibold text-ink">
                {entry.project?.name ?? 'Project invitation'}
              </span>
              <Button size="sm" onClick={() => invitation.mutate({ id: entry.id, accept: true })}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => invitation.mutate({ id: entry.id, accept: false })}
              >
                Decline
              </Button>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

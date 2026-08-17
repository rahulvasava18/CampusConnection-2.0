import type { FormEvent, ReactNode } from 'react';
import { FolderKanban, Network, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCommunity,
  createMilestone,
  createProject,
  createTask,
  createTeam,
  getCommunities,
  getCommunityMembers,
  getMilestones,
  getProjects,
  getProjectMembers,
  getTasks,
  getTeamMembers,
  getTeams,
  joinCommunity,
  joinTeam,
  leaveCommunity,
  leaveTeam,
  updateTaskStatus,
} from './collaboration.api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  SectionHeading,
  TextareaField,
} from '../../components/ui';
import { collectionItems } from '../../lib/api-state';

const communitySchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(1),
  category: z.string().min(1),
  privacy: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
});
const teamSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(1),
  goal: z.string().min(1),
  category: z.string().min(1),
  tags: z.string().optional(),
  lookingFor: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  maxMembers: z.coerce.number().int().min(1).optional(),
});
const projectSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(1),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'CONNECTIONS', 'PRIVATE']),
  technologies: z.string().optional(),
});
const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});
const milestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  order: z.coerce.number().int().min(0),
});
type FormProps = { onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode };
function Form({ onSubmit, children }: FormProps) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      {children}
    </form>
  );
}
const selectClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10';

export function CollaborationHome() {
  const queryClient = useQueryClient();
  const [communityId, setCommunityId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [projectId, setProjectId] = useState('');
  const communities = useQuery({ queryKey: ['communities'], queryFn: getCommunities });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => getTeams() });
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => getProjects() });
  const communityMembers = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => getCommunityMembers(communityId),
    enabled: Boolean(communityId),
  });
  const teamMembers = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => getTeamMembers(teamId),
    enabled: Boolean(teamId),
  });
  const projectMembers = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => getProjectMembers(projectId),
    enabled: Boolean(projectId),
  });
  const tasks = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => getTasks(projectId),
    enabled: Boolean(projectId),
  });
  const milestones = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => getMilestones(projectId),
    enabled: Boolean(projectId),
  });
  const communityItems = collectionItems(communities.data);
  const teamItems = collectionItems(teams.data);
  const projectItems = collectionItems(projects.data);
  const communityMemberItems = collectionItems(communityMembers.data);
  const teamMemberItems = collectionItems(teamMembers.data);
  const projectMemberItems = collectionItems(projectMembers.data);
  const taskItems = collectionItems(tasks.data);
  const milestoneItems = collectionItems(milestones.data);
  const invalidate = (key: string) => void queryClient.invalidateQueries({ queryKey: [key] });
  const communityForm = useForm({
    resolver: zodResolver(communitySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      category: 'Student community',
      privacy: 'PUBLIC' as const,
    },
  });
  const teamForm = useForm({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      description: '',
      goal: '',
      category: 'Project',
      tags: '',
      lookingFor: '',
      visibility: 'PUBLIC' as const,
    },
  });
  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      visibility: 'PUBLIC' as const,
      technologies: '',
    },
  });
  const taskForm = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', description: '', priority: 'MEDIUM' as const },
  });
  const milestoneForm = useForm({
    resolver: zodResolver(milestoneSchema),
    defaultValues: { title: '', description: '', order: 0 },
  });
  const communityCreate = useMutation({
    mutationFn: createCommunity,
    onSuccess: () => {
      communityForm.reset();
      invalidate('communities');
    },
  });
  const teamCreate = useMutation({
    mutationFn: (input: Record<string, unknown>) => {
      const { tags, lookingFor, ...base } = input;
      return createTeam({
        ...base,
        tags: String(tags ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        lookingFor: String(lookingFor ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        ...(communityId ? { communityId } : {}),
      });
    },
    onSuccess: () => {
      teamForm.reset();
      invalidate('teams');
    },
  });
  const projectCreate = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      createProject({
        ...input,
        technologies: String(input.technologies ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      projectForm.reset();
      invalidate('projects');
    },
  });
  const taskCreate = useMutation({
    mutationFn: (input: Record<string, unknown>) => createTask(projectId, input),
    onSuccess: () => {
      taskForm.reset();
      invalidate('tasks');
    },
  });
  const milestoneCreate = useMutation({
    mutationFn: (input: Record<string, unknown>) => createMilestone(projectId, input),
    onSuccess: () => {
      milestoneForm.reset();
      invalidate('milestones');
    },
  });
  const joinCommunityMutation = useMutation({
    mutationFn: () => joinCommunity(communityId),
    onSuccess: () => invalidate('community-members'),
  });
  const joinTeamMutation = useMutation({
    mutationFn: () => joinTeam(teamId),
    onSuccess: () => invalidate('team-members'),
  });

  return (
    <section className="space-y-5">
      <SectionHeading
        eyebrow="Collaboration"
        title="Build together"
        description="Turn campus ideas into communities, teams, and projects with momentum."
        action={<Badge tone="brand">Workspace</Badge>}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
              <Network className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-ink">Communities</h3>
              <p className="text-xs text-muted">Shared interests and belonging</p>
            </div>
          </div>
          <Form onSubmit={communityForm.handleSubmit((value) => communityCreate.mutate(value))}>
            <Field
              aria-label="Community name"
              label="Name"
              placeholder="Community name"
              {...communityForm.register('name')}
            />
            <Field
              aria-label="Community slug"
              label="Slug"
              placeholder="community-slug"
              {...communityForm.register('slug')}
            />
            <Field
              aria-label="Community category"
              label="Category"
              placeholder="Category"
              {...communityForm.register('category')}
            />
            <TextareaField
              aria-label="Community description"
              label="Description"
              placeholder="Description"
              {...communityForm.register('description')}
            />
            <Button type="submit">
              <Plus className="h-4 w-4" />
              Create community
            </Button>
          </Form>
          <select
            aria-label="Selected community"
            value={communityId}
            onChange={(event) => setCommunityId(event.target.value)}
            className={`${selectClass} mt-4`}
          >
            <option value="">Select a community</option>
            {communityItems.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {communityId ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{communityMemberItems.length} members</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => joinCommunityMutation.mutate()}>
                  Join
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void leaveCommunity(communityId).then(() => invalidate('community-members'))
                  }
                >
                  Leave
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-xl bg-cyan/10 p-2.5 text-cyan">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-ink">Teams</h3>
              <p className="text-xs text-muted">Find your people and roles</p>
            </div>
          </div>
          <Form onSubmit={teamForm.handleSubmit((value) => teamCreate.mutate(value))}>
            <Field
              aria-label="Team name"
              label="Name"
              placeholder="Team name"
              {...teamForm.register('name')}
            />
            <TextareaField
              aria-label="Team description"
              label="Description"
              placeholder="Description"
              {...teamForm.register('description')}
            />
            <TextareaField
              label="Goal"
              placeholder="What will this team accomplish?"
              {...teamForm.register('goal')}
            />
            <Field
              label="Category"
              placeholder="Project, hackathon, research"
              {...teamForm.register('category')}
            />
            <Field label="Tags" placeholder="React, AI, design" {...teamForm.register('tags')} />
            <Field
              label="Looking for"
              placeholder="Frontend developer, designer"
              {...teamForm.register('lookingFor')}
            />
            <Button type="submit">
              <Plus className="h-4 w-4" />
              Create team
            </Button>
          </Form>
          <select
            aria-label="Selected team"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            className={`${selectClass} mt-4`}
          >
            <option value="">Select a team</option>
            {teamItems.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {teamId ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{teamMemberItems.length} members</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => joinTeamMutation.mutate()}>
                  Join
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void leaveTeam(teamId).then(() => invalidate('team-members'))}
                >
                  Leave
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
        <Card className="p-5 xl:col-span-1">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
              <FolderKanban className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-ink">Projects</h3>
              <p className="text-xs text-muted">Move ideas into delivery</p>
            </div>
          </div>
          <Form onSubmit={projectForm.handleSubmit((value) => projectCreate.mutate(value))}>
            <Field
              aria-label="Project name"
              label="Name"
              placeholder="Project name"
              {...projectForm.register('name')}
            />
            <Field
              aria-label="Project slug"
              label="Slug"
              placeholder="project-slug"
              {...projectForm.register('slug')}
            />
            <TextareaField
              aria-label="Project description"
              label="Description"
              placeholder="Description"
              {...projectForm.register('description')}
            />
            <Field
              aria-label="Project technologies"
              label="Technologies"
              placeholder="React, MongoDB"
              {...projectForm.register('technologies')}
            />
            <Button type="submit">
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          </Form>
          <select
            aria-label="Selected project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={`${selectClass} mt-4`}
          >
            <option value="">Select a project</option>
            {projectItems.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {projectId ? (
            <div className="mt-5 space-y-5 border-t border-line pt-5">
              <p className="text-xs font-semibold text-muted">
                {projectMemberItems.length} project members
              </p>
              <Form onSubmit={taskForm.handleSubmit((value) => taskCreate.mutate(value))}>
                <h4 className="font-display font-bold text-ink">New task</h4>
                <Field
                  aria-label="Task title"
                  label="Title"
                  placeholder="Task title"
                  {...taskForm.register('title')}
                />
                <Field
                  aria-label="Task description"
                  label="Description"
                  placeholder="Task description"
                  {...taskForm.register('description')}
                />
                <Button type="submit" variant="secondary">
                  Add task
                </Button>
              </Form>
              <div className="grid gap-2">
                {taskItems.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
                  >
                    <span>
                      <Badge tone={task.status === 'DONE' ? 'success' : 'neutral'}>
                        {task.status}
                      </Badge>
                      <span className="ml-2 font-semibold text-ink">{task.title}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void updateTaskStatus(
                          task.id,
                          task.status === 'TODO'
                            ? 'IN_PROGRESS'
                            : task.status === 'IN_PROGRESS'
                              ? 'DONE'
                              : task.status,
                        )
                      }
                    >
                      Advance
                    </Button>
                  </div>
                ))}
              </div>
              <Form onSubmit={milestoneForm.handleSubmit((value) => milestoneCreate.mutate(value))}>
                <h4 className="font-display font-bold text-ink">New milestone</h4>
                <Field
                  aria-label="Milestone title"
                  label="Title"
                  placeholder="Milestone title"
                  {...milestoneForm.register('title')}
                />
                <Field
                  aria-label="Milestone description"
                  label="Description"
                  placeholder="Milestone description"
                  {...milestoneForm.register('description')}
                />
                <Button type="submit" variant="secondary">
                  Add milestone
                </Button>
              </Form>
              <div className="grid gap-2">
                {milestoneItems.map((milestone) => (
                  <p
                    key={milestone.id}
                    className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800"
                  >
                    <strong>{milestone.order}.</strong> {milestone.title} · {milestone.status}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="Choose a project"
                description="Select a project to manage tasks and milestones."
              />
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

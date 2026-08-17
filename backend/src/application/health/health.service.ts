export interface DependencyHealth {
  status: 'up' | 'down';
  detail?: string;
}

export interface HealthSnapshot {
  status: 'ready' | 'not_ready';
  service: string;
  timestamp: string;
  dependencies: {
    mongodb: DependencyHealth;
    redis: DependencyHealth;
    bullmq: DependencyHealth;
  };
}

export class HealthService {
  public constructor(
    private readonly mongoReady: () => boolean,
    private readonly redisReady: () => boolean,
    private readonly serviceName: string,
    private readonly queueReady: () => boolean = redisReady,
  ) {}

  public getLiveness(): { status: 'ok'; service: string; timestamp: string } {
    return { status: 'ok', service: this.serviceName, timestamp: new Date().toISOString() };
  }

  public getReadiness(): HealthSnapshot {
    const mongodb: DependencyHealth = { status: this.mongoReady() ? 'up' : 'down' };
    const redis: DependencyHealth = { status: this.redisReady() ? 'up' : 'down' };
    const bullmq: DependencyHealth = { status: this.queueReady() ? 'up' : 'down' };
    const ready = mongodb.status === 'up' && redis.status === 'up' && bullmq.status === 'up';
    return {
      status: ready ? 'ready' : 'not_ready',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      dependencies: { mongodb, redis, bullmq },
    };
  }
}

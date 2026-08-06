import { Queue, Worker, type Job, type Processor } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const QUEUE_NAMES = {
  documentGeneration: "document-generation",
  followUp: "follow-up",
} as const;

type DocumentJobData = {
  jobId: string;
};

type FollowUpJobData = {
  followUpId: string;
};

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

let documentQueue: Queue<DocumentJobData> | null = null;
let followUpQueue: Queue<FollowUpJobData> | null = null;

export function getDocumentQueue(): Queue<DocumentJobData> {
  if (!documentQueue) {
    documentQueue = new Queue<DocumentJobData>(QUEUE_NAMES.documentGeneration, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
      },
    });
  }
  return documentQueue;
}

export function getFollowUpQueue(): Queue<FollowUpJobData> {
  if (!followUpQueue) {
    followUpQueue = new Queue<FollowUpJobData>(QUEUE_NAMES.followUp, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
      },
    });
  }
  return followUpQueue;
}

export async function enqueueDocumentJob(jobId: string): Promise<void> {
  await getDocumentQueue().add("generate", { jobId }, { jobId });
}

export async function enqueueFollowUpJob(followUpId: string): Promise<void> {
  await getFollowUpQueue().add("process", { followUpId }, { jobId: followUpId });
}

export function createWorker<T extends object>(
  queueName: string,
  processor: Processor<T>,
  concurrency = 1,
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: getConnection(),
    concurrency,
    limiter: { max: 5, duration: 1000 },
  });
}

export type { DocumentJobData, FollowUpJobData, Job };

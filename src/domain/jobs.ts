import { z } from 'zod';

export const JobSchema = z.object({
  id: z.string(), type: z.enum(['discovery', 'routes']),
  status: z.enum(['queued', 'running', 'partial', 'succeeded', 'failed', 'cancelled']),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  progress: z.object({ completed: z.number().nonnegative(), total: z.number().nonnegative().nullable(), message: z.string() }),
  snapshotId: z.string().nullable(), error: z.object({ code: z.string(), message: z.string() }).nullable(),
});
export type Job = z.infer<typeof JobSchema>;

import { Types, type FilterQuery, type Model } from 'mongoose';
import { z } from 'zod';
import { badRequest } from '../errors.js';

export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Cursor pagination on _id. dir 'asc' (default) or 'desc'. */
export async function paginate<T extends { _id: Types.ObjectId }>(
  model: Model<T>,
  filter: FilterQuery<T>,
  q: { limit: number; cursor?: string },
  dir: 'asc' | 'desc' = 'asc',
): Promise<Page<T>> {
  const f: FilterQuery<T> = { ...filter };
  if (q.cursor) {
    if (!Types.ObjectId.isValid(q.cursor)) throw badRequest('Invalid cursor');
    (f as Record<string, unknown>)._id = {
      [dir === 'asc' ? '$gt' : '$lt']: new Types.ObjectId(q.cursor),
    };
  }
  const rows = (await model
    .find(f)
    .sort({ _id: dir === 'asc' ? 1 : -1 })
    .limit(q.limit + 1)
    .lean()) as unknown as T[];
  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, q.limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? last._id.toString() : null };
}

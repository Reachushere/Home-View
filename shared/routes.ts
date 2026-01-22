import { z } from 'zod';
import { insertTaskSchema, tasks, insertSemesterSettingsSchema, semesterSettings } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/tasks',
      input: z.object({
        weekNumber: z.coerce.number().optional(),
        type: z.string().optional(),
        showCompleted: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof tasks.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tasks/:id',
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tasks',
      input: insertTaskSchema,
      responses: {
        201: z.custom<typeof tasks.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/tasks/:id',
      input: insertTaskSchema.partial(),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/tasks/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    complete: {
      method: 'PATCH' as const,
      path: '/api/tasks/:id/complete',
      input: z.object({ isCompleted: z.boolean() }),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    reschedule: {
      method: 'PATCH' as const,
      path: '/api/tasks/:id/reschedule',
      input: z.object({ 
        dueDate: z.string(),
        weekNumber: z.coerce.number(),
      }),
      responses: {
        200: z.custom<typeof tasks.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    exportCalendar: {
      method: 'GET' as const,
      path: '/api/tasks/:id/ics',
      responses: {
        200: z.string(),
        404: errorSchemas.notFound,
      },
    },
  },
  weeks: {
    current: {
      method: 'GET' as const,
      path: '/api/weeks/current',
      responses: {
        200: z.object({
          weekNumber: z.number(),
          startDate: z.string(),
          endDate: z.string(),
        }),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/weeks',
      responses: {
        200: z.array(z.object({
          weekNumber: z.number(),
          startDate: z.string(),
          endDate: z.string(),
          taskCount: z.number(),
        })),
      },
    },
  },
  semester: {
    get: {
      method: 'GET' as const,
      path: '/api/semester',
      responses: {
        200: z.custom<typeof semesterSettings.$inferSelect>().nullable(),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/semester',
      input: insertSemesterSettingsSchema,
      responses: {
        201: z.custom<typeof semesterSettings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

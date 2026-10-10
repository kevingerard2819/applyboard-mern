import { z } from 'zod';
import { statuses } from '../shared/statuses.js';

const date = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a valid date in YYYY-MM-DD format');

const url = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      return ['https:', 'http:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Use an http or https URL');

const interviewRound = z
  .object({
    id: z.string().uuid(),
    label: z.string().trim().min(1, 'Round name is required').max(100),
    at: z.string().datetime({ offset: true }),
    status: z.enum(['Scheduled', 'Completed', 'Cancelled']).default('Scheduled'),
    notes: z.string().trim().max(1000).default(''),
  })
  .strict();

export const applicationInput = z
  .object({
    company: z.string().trim().min(1, 'Company is required').max(100),
    role: z.string().trim().min(1, 'Role is required').max(150),
    location: z.string().trim().max(100).default(''),
    status: z.enum(statuses).default('Wishlist'),
    url: url.default(''),
    appliedDate: date.default(''),
    notes: z.string().trim().max(5000).default(''),
    followUpDate: date.default(''),
    nextStep: z.string().trim().max(200).default(''),
    interviewAt: z.union([z.literal(''), z.string().datetime({ offset: true })]).default(''),
    interviewNotes: z.string().trim().max(1000).default(''),
    interviewRounds: z
      .array(interviewRound)
      .max(10)
      .refine(
        (rounds) => new Set(rounds.map((round) => round.id)).size === rounds.length,
        'Round IDs must be unique',
      )
      .default([]),
  })
  .strict();

export const applicationPatch = applicationInput
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

import { z } from "zod";

// Validation schema for POST /api/generations
export const CreateGenerationSchema = z.object({
  promptText: z
    .string()
    .min(1000, "promptText must be at least 1000 characters long")
    .max(10000, "promptText must be at most 10000 characters long"),
});

export type CreateGenerationInput = z.infer<typeof CreateGenerationSchema>;

export const AcceptGenerationProposalsItemSchema = z.object({
  front: z
    .string()
    .trim()
    .min(1, "front must be at least 1 character long")
    .max(200, "front must be at most 200 characters long"),
  back: z
    .string()
    .trim()
    .min(1, "back must be at least 1 character long")
    .max(500, "back must be at most 500 characters long"),
  edited: z.boolean(),
});

export const AcceptGenerationProposalsSchema = z.object({
  flashcards: z.array(AcceptGenerationProposalsItemSchema).min(1, "flashcards must contain at least one item"),
});

export type AcceptGenerationProposalsInput = z.infer<typeof AcceptGenerationProposalsSchema>;

// ----------------------------
// Query validation
// ----------------------------

// GET /api/generations
export const GenerationsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
  // Example values: "created_at:desc", "updated_at:asc"
  sort: z.enum(["created_at:asc", "created_at:desc", "updated_at:asc", "updated_at:desc"]).default("created_at:desc"),
});

export type GenerationsListQueryParams = z.infer<typeof GenerationsListQuerySchema>;

// GET /api/generations/:id
export const GetGenerationQuerySchema = z.object({
  includeFlashcards: z
    .union([z.literal("true"), z.literal("false")])
    .transform((value) => value === "true")
    .optional(),
});

export type GetGenerationQueryParams = z.infer<typeof GetGenerationQuerySchema>;

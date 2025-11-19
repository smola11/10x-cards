import { z } from "zod";

export const FlashcardsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["created_at", "updated_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  origin: z.enum(["manual", "ai-full", "ai-edited"]).optional(),
  generationId: z.coerce.number().int().positive().optional(),
});

export type FlashcardsListQueryParams = z.infer<typeof FlashcardsListQuerySchema>;

export const CreateManualFlashcardSchema = z
  .object({
    front: z.string().min(1).max(200),
    back: z.string().min(1).max(500),
  })
  .strict();

export type CreateManualFlashcardBody = z.infer<typeof CreateManualFlashcardSchema>;

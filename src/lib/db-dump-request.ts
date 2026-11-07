import { z } from "zod";

export const dumpRequestSchema = z.object({ mode: z.enum(["full", "schema", "data"]) }).strict();
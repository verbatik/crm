import { z } from "zod";
import { SPEECHYOU_SYNC } from "./speechyou.config";

export const speechyouAccount = z.object({
	visitorId: z
		.string()
		.regex(/^[A-Za-z0-9_-]{8,64}$/)
		.nullable()
		.optional(),
	id: z.string().trim().min(1).max(128),
	email: z
		.email()
		.max(320)
		.transform((value) => value.toLowerCase()),
	name: z.string().trim().max(300),
	lastName: z.string().trim().max(300).nullable(),
	language: z
		.enum(["en", "pt", "es", "ja", "ar", "fr", "de", "it", "nl", "ru"])
		.nullable(),
});

export const speechyouBatch = z.object({
	accounts: z.array(speechyouAccount).min(1).max(SPEECHYOU_SYNC.batchSize),
});

export type SpeechyouAccount = z.infer<typeof speechyouAccount>;

import { z } from "zod";
import { PERPLEXITY } from "./perplexity-config";

const responseSchema = z.object({
	status: z.literal("completed"),
	output: z.array(
		z.object({
			type: z.string(),
			content: z
				.array(z.object({ type: z.string(), text: z.string().optional() }))
				.optional(),
			results: z.array(z.object({ url: z.string().url() })).optional(),
		}),
	),
});

export type Answer = {
	text: string;
	citations: string[];
};

type Outcome<T> = { ok: true; data: T } | { ok: false; reason: string };

export function perplexityEnabled(): boolean {
	return Boolean(process.env.PERPLEXITY_API_KEY);
}

export type AskOptions = {
	preset?: "fast" | "low";
	domains?: string[];
	system?: string;
};

export async function ask(
	question: string,
	options: AskOptions = {},
): Promise<Outcome<Answer>> {
	const apiKey = process.env.PERPLEXITY_API_KEY;
	if (!apiKey) return { ok: false, reason: "No PERPLEXITY_API_KEY." };

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PERPLEXITY.timeoutMs);

	try {
		const response = await fetch(PERPLEXITY.endpoint, {
			method: "POST",
			headers: {
				authorization: `Bearer ${apiKey}`,
				"content-type": "application/json",
			},
			signal: controller.signal,
			body: JSON.stringify({
				preset: options.preset ?? PERPLEXITY.defaultPreset,
				input: question,
				instructions: options.system,
				tools: [
					{
						type: "web_search",
						filters: { search_domain_filter: options.domains },
					},
				],
			}),
		});

		if (!response.ok) {
			return { ok: false, reason: `HTTP ${response.status}` };
		}

		const parsed = responseSchema.safeParse(await response.json());
		if (!parsed.success)
			return { ok: false, reason: "Invalid or incomplete research response." };
		const body = parsed.data;
		const text = body.output
			.filter((item) => item.type === "message")
			.flatMap((item) => item.content ?? [])
			.filter((item) => item.type === "output_text")
			.map((item) => item.text ?? "")
			.join("\n")
			.trim();
		if (!text) return { ok: false, reason: "Empty answer." };

		const citations = [
			...new Set(
				body.output
					.filter((item) => item.type === "search_results")
					.flatMap((item) => item.results ?? [])
					.map((result) => result.url),
			),
		];

		return { ok: true, data: { text, citations } };
	} catch (error) {
		const aborted = error instanceof Error && error.name === "AbortError";
		return {
			ok: false,
			reason: aborted
				? `Timed out after ${PERPLEXITY.timeoutMs}ms.`
				: error instanceof Error
					? error.message
					: String(error),
		};
	} finally {
		clearTimeout(timer);
	}
}

export async function findProfileUrls(
	terms: string[],
	companyName: string,
): Promise<string[]> {
	const slugs: string[] = [];

	for (const term of terms) {
		const answer = await ask(
			`Find the LinkedIn profile of the person called "${term}" who works at ${companyName}. Reply with their profile URL only.`,
			{ domains: ["linkedin.com"] },
		);

		if (!answer.ok) continue;

		const haystack = [answer.data.text, ...answer.data.citations].join(" ");
		for (const match of haystack.matchAll(
			/linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/g,
		)) {
			const slug = match[1];
			if (slug && !slugs.includes(slug)) slugs.push(slug);
		}

		if (slugs.length > 0) break;
	}

	return slugs;
}

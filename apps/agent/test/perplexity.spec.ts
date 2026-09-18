import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { ask } from "../agent/lib/perplexity";

const originalKey = process.env.PERPLEXITY_API_KEY;
let fetchMock: ReturnType<typeof spyOn> | undefined;

afterEach(() => {
	fetchMock?.mockRestore();
	if (originalKey === undefined) delete process.env.PERPLEXITY_API_KEY;
	else process.env.PERPLEXITY_API_KEY = originalKey;
});

describe("Perplexity research", () => {
	it("keeps search filters and reads answer text and unique sources", async () => {
		process.env.PERPLEXITY_API_KEY = "test-key";
		fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({
				status: "completed",
				output: [
					{ type: "reasoning", summary: [] },
					{
						type: "search_results",
						results: [
							{ url: "https://example.com/source" },
							{ url: "https://example.com/source" },
						],
					},
					{
						type: "message",
						content: [{ type: "output_text", text: "A supported answer.[1]" }],
					},
				],
			}),
		);
		const result = await ask("Research this company", {
			preset: "low",
			domains: ["example.com"],
			system: "Use sources.",
		});
		expect(result).toEqual({
			ok: true,
			data: {
				text: "A supported answer.[1]",
				citations: ["https://example.com/source"],
			},
		});
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://api.perplexity.ai/v1/agent");
		expect(JSON.parse(init.body)).toEqual({
			preset: "low",
			input: "Research this company",
			instructions: "Use sources.",
			tools: [
				{
					type: "web_search",
					filters: { search_domain_filter: ["example.com"] },
				},
			],
		});
	});

	it("refuses incomplete output instead of filing partial research", async () => {
		process.env.PERPLEXITY_API_KEY = "test-key";
		fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({ status: "incomplete", output: [] }),
		);
		expect((await ask("Research")).ok).toBe(false);
	});

	it("keeps missing credentials optional without sending a request", async () => {
		delete process.env.PERPLEXITY_API_KEY;
		fetchMock = spyOn(globalThis, "fetch");
		expect((await ask("Research")).ok).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

import "reflect-metadata";
import { describe, expect, mock, test } from "bun:test";
import type { Db } from "@crm/db";
import type { ConfigService } from "@nestjs/config";
import { domainFromEmail } from "../../src/companies/domain";
import type { EnvironmentVariables } from "../../src/config/env.validation";
import { speechyouBatch } from "../../src/speechyou/speechyou.contracts";
import { SpeechyouController } from "../../src/speechyou/speechyou.controller";
import { SpeechyouService } from "../../src/speechyou/speechyou.service";

const account = {
	id: "user-1",
	email: "jane@acme-business.com",
	name: "Jane Doe",
	lastName: null,
	language: "fr" as const,
};

function fixture() {
	const contacts: { id: string; email: string; archivedAt: Date | null }[] = [];
	const values = new Map<string, string>();
	const tx = {
		$queryRaw: mock(async () => []),
		suppressedContact: { findFirst: mock(async () => null) },
		suppressedDomain: { findUnique: mock(async () => null) },
		company: { findFirst: mock(async () => ({ id: "company-1" })) },
		trackedVisitor: { upsert: mock(async () => ({})) },
		contact: {
			findFirst: mock(
				async (args: {
					where: {
						fieldValues?: object;
						email?: { equals: string };
						archivedAt?: unknown;
					};
				}) => {
					if (args.where.fieldValues)
						return (
							contacts.find(
								(contact) =>
									values.get(`${contact.id}:speechyou_user_id`) === "user-1",
							) ?? null
						);
					return (
						contacts.find(
							(contact) =>
								contact.email === args.where.email?.equals &&
								contact.archivedAt === args.where.archivedAt,
						) ?? null
					);
				},
			),
			create: mock(async ({ data }: { data: { email: string } }) => {
				const contact = { id: "contact-1", archivedAt: null, ...data };
				contacts.push(contact);
				return contact;
			}),
			update: mock(async ({ data }: { data: { email: string } }) =>
				Object.assign(contacts[0] ?? {}, data),
			),
		},
		fieldValue: {
			upsert: mock(
				async ({
					create,
				}: {
					create: { fieldId: string; contactId: string; text: string };
				}) => {
					values.set(`${create.contactId}:${create.fieldId}`, create.text);
				},
			),
		},
	};
	const db = {
		fieldDefinition: {
			upsert: mock(async ({ create }: { create: { key: string } }) => ({
				...create,
				id: create.key,
				archivedAt: null,
			})),
		},
		$transaction: mock(
			async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
		),
	};
	return {
		service: new SpeechyouService(db as unknown as Db),
		db,
		tx,
		values,
		contacts,
	};
}

describe("Speechyou account sync", () => {
	test("rejects personal providers and preserves custom business domains", () => {
		for (const domain of [
			"gmail.com",
			"googlemail.com",
			"yahoo.fr",
			"outlook.com",
			"hotmail.co.uk",
			"icloud.com",
			"proton.me",
			"mailinator.com",
		])
			expect(domainFromEmail(`User@${domain}`)).toBeNull();
		expect(domainFromEmail("  Jane@Acme-Business.com  ")).toBe(
			"acme-business.com",
		);
		expect(domainFromEmail("employee@google.com")).toBe("google.com");
	});
	test("stores name, language and company domain, then updates without duplication", async () => {
		const f = fixture();
		expect((await f.service.sync([account])).results[0]?.status).toBe("synced");
		await f.service.sync([{ ...account, name: "Janet Doe", language: "de" }]);
		expect(f.contacts).toHaveLength(1);
		expect(f.tx.contact.create).toHaveBeenCalledTimes(1);
		expect(f.tx.contact.update).toHaveBeenCalledTimes(1);
		expect(f.values.get("contact-1:speechyou_language")).toBe("German");
		expect(f.values.get("contact-1:speechyou_domain")).toBe(
			"acme-business.com",
		);
		expect(f.tx.contact.update.mock.calls[0]?.[0].data).toMatchObject({
			firstName: "Janet",
			lastName: "Doe",
		});
	});
	test("personal accounts produce no contacts", async () => {
		const f = fixture();
		expect(
			(await f.service.sync([{ ...account, email: "jane@gmail.com" }]))
				.results[0]?.status,
		).toBe("ignored");
		expect(f.db.$transaction).not.toHaveBeenCalled();
	});
	test("unknown historical language preserves a known language", async () => {
		const f = fixture();
		await f.service.sync([account]);
		await f.service.sync([{ ...account, language: null }]);
		expect(f.values.get("contact-1:speechyou_language")).toBe("French");
	});
	test("archived contacts remain archived", async () => {
		const f = fixture();
		await f.service.sync([account]);
		const contact = f.contacts[0];
		if (!contact) throw new Error("Expected a contact");
		contact.archivedAt = new Date();
		expect((await f.service.sync([account])).results[0]?.status).toBe(
			"ignored",
		);
		expect(f.tx.contact.update).not.toHaveBeenCalled();
	});
	test("rejects oversized batches and invalid languages", () => {
		expect(
			speechyouBatch.safeParse({ accounts: Array(51).fill(account) }).success,
		).toBe(false);
		expect(
			speechyouBatch.safeParse({
				accounts: [{ ...account, language: "invented" }],
			}).success,
		).toBe(false);
	});
	test("requires the server secret before touching account data", async () => {
		const f = fixture();
		const config = {
			get: () => "secret-key-with-at-least-32-characters",
		} as unknown as ConfigService<EnvironmentVariables, true>;
		const controller = new SpeechyouController(config, f.service);
		await expect(
			controller.sync(undefined, { accounts: [account] }),
		).rejects.toThrow();
		await expect(
			controller.sync("Bearer wrong", { accounts: [account] }),
		).rejects.toThrow();
		expect(f.db.fieldDefinition.upsert).not.toHaveBeenCalled();
	});
});

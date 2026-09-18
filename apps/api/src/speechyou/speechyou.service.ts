import type { Db } from "@crm/db";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { Injectable, Logger } from "@nestjs/common";
import { domainFromEmail } from "../companies/domain";
import { InjectDatabase } from "../database/database.constants";
import { splitName } from "../mailbox/participants";
import { SPEECHYOU_SYNC } from "./speechyou.config";
import type { SpeechyouAccount } from "./speechyou.contracts";

@Injectable()
export class SpeechyouService {
	private readonly logger = new Logger(SpeechyouService.name);
	constructor(@InjectDatabase() private readonly db: Db) {}

	async sync(accounts: SpeechyouAccount[]) {
		const definitions = await Promise.all(
			SPEECHYOU_SYNC.fields.map((field, position) =>
				this.db.fieldDefinition.upsert({
					where: { entity_key: { entity: "CONTACT", key: field.key } },
					create: {
						...field,
						entity: "CONTACT",
						type: "TEXT",
						agentFilled: false,
						showOnSheet: true,
						position,
					},
					update: {},
				}),
			),
		);
		const results: {
			id: string;
			status: "synced" | "ignored" | "retry";
			contactId?: string;
		}[] = [];
		for (const account of accounts) {
			const domain = domainFromEmail(account.email);
			if (!domain) {
				results.push({ id: account.id, status: "ignored" });
				continue;
			}
			try {
				const contactId = await this.db.$transaction(async (tx) => {
					await lockIdempotencyKey(tx, `speechyou:${account.id}`);
					await lockIdempotencyKey(tx, `speechyou-email:${account.email}`);
					const suppressed = await tx.suppressedContact.findFirst({
						where: { email: { equals: account.email, mode: "insensitive" } },
					});
					const suppressedDomain = await tx.suppressedDomain.findUnique({
						where: { domain },
					});
					if (suppressed || suppressedDomain) return null;
					const linked = await tx.contact.findFirst({
						where: {
							fieldValues: {
								some: {
									field: { key: "speechyou_user_id", entity: "CONTACT" },
									text: account.id,
								},
							},
						},
					});
					if (linked?.archivedAt) return null;
					const existing =
						linked ??
						(await tx.contact.findFirst({
							where: {
								email: { equals: account.email, mode: "insensitive" },
								archivedAt: null,
							},
						}));
					const archived =
						!existing &&
						(await tx.contact.findFirst({
							where: {
								email: { equals: account.email, mode: "insensitive" },
								archivedAt: { not: null },
							},
						}));
					if (archived) return null;
					await lockIdempotencyKey(tx, `company-directory:${domain}`);
					const company =
						(await tx.company.findFirst({
							where: { domain, archivedAt: null },
						})) ??
						(await tx.company.create({
							data: {
								name: domain,
								domain,
								website: `https://${domain}`,
								source: "IMPORT",
							},
						}));
					const name = account.lastName
						? {
								firstName:
									account.name || account.email.split("@")[0] || account.email,
								lastName: account.lastName,
							}
						: splitName(account.name, account.email);
					const data = { ...name, email: account.email, companyId: company.id };
					const contact = existing
						? await tx.contact.update({ where: { id: existing.id }, data })
						: await tx.contact.create({ data: { ...data, source: "IMPORT" } });
					const values = {
						speechyou_user_id: account.id,
						speechyou_domain: domain,
						speechyou_language: account.language
							? SPEECHYOU_SYNC.languages[account.language]
							: null,
					};
					for (const field of definitions) {
						const value = values[field.key as keyof typeof values];
						if (!value || field.archivedAt || field.type !== "TEXT") continue;
						await tx.fieldValue.upsert({
							where: {
								fieldId_contactId: { fieldId: field.id, contactId: contact.id },
							},
							create: { fieldId: field.id, contactId: contact.id, text: value },
							update: { text: value },
						});
					}
					if (account.visitorId) {
						await tx.trackedVisitor.upsert({
							where: { id: account.visitorId },
							create: { id: account.visitorId, contactId: contact.id },
							update: { contactId: contact.id },
						});
					}
					return contact.id;
				});
				results.push(
					contactId
						? { id: account.id, status: "synced", contactId }
						: { id: account.id, status: "ignored" },
				);
			} catch {
				this.logger.error({
					message: "Speechyou account sync failed; retry required",
					accountId: account.id,
				});
				results.push({ id: account.id, status: "retry" });
			}
		}
		return { results };
	}
}

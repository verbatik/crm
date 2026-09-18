import { createHash, timingSafeEqual } from "node:crypto";
import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	Headers,
	HttpCode,
	Post,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { speechyouBatch } from "./speechyou.contracts";
import { SpeechyouService } from "./speechyou.service";

@Controller("integrations/speechyou")
export class SpeechyouController {
	constructor(
		private readonly config: ConfigService<EnvironmentVariables, true>,
		private readonly service: SpeechyouService,
	) {}

	@Post("accounts")
	@AllowAnonymous()
	@HttpCode(200)
	async sync(
		@Headers("authorization") authorization: string | undefined,
		@Body() body: unknown,
	) {
		const secret = this.config.get("SPEECHYOU_SYNC_SECRET", { infer: true });
		if (!secret)
			throw new ServiceUnavailableException("Speechyou sync is disabled.");
		const hash = (value: string) => createHash("sha256").update(value).digest();
		if (!timingSafeEqual(hash(authorization ?? ""), hash(`Bearer ${secret}`)))
			throw new ForbiddenException();
		const parsed = speechyouBatch.safeParse(body);
		if (!parsed.success)
			throw new BadRequestException("Invalid Speechyou account batch.");
		return this.service.sync(parsed.data.accounts);
	}
}

import KeyvRedis from "@keyv/redis";
import { CacheModule, type CacheOptions } from "@nestjs/cache-manager";
import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Keyv } from "keyv";
import { KeyvUpstash } from "keyv-upstash";
import type { EnvironmentVariables } from "../config/env.validation";

const DEFAULT_TTL_MS = 60_000;

@Module({
	imports: [
		CacheModule.registerAsync({
			isGlobal: true,
			inject: [ConfigService],
			useFactory: (
				config: ConfigService<EnvironmentVariables, true>,
			): CacheOptions => {
				const logger = new Logger("CacheModule");
				const redisUrl = config.get("REDIS_URL", { infer: true });
				const upstashUrl = config.get("UPSTASH_REDIS_REST_URL", {
					infer: true,
				});
				const upstashToken = config.get("UPSTASH_REDIS_REST_TOKEN", {
					infer: true,
				});
				const ttl =
					config.get("CACHE_TTL_MS", { infer: true }) ?? DEFAULT_TTL_MS;

				if (upstashUrl && upstashToken) {
					logger.log({ message: "Cache backed by Upstash Redis REST", ttl });
					return {
						ttl,
						stores: [
							new Keyv({
								namespace: "speechyou-crm",
								store: new KeyvUpstash({
									url: upstashUrl,
									token: upstashToken,
								}),
							}),
						],
					};
				}

				if (!redisUrl) {
					logger.warn({
						message:
							"Redis is not configured — falling back to a per-instance in-memory cache.",
						ttl,
					});
					return { ttl };
				}

				logger.log({ message: "Cache backed by Redis", ttl });

				return { ttl, stores: [new KeyvRedis(redisUrl)] };
			},
		}),
	],
	exports: [CacheModule],
})
export class AppCacheModule {}

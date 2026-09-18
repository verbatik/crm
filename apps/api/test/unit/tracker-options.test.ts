import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { trackerSource } from "../../../app/lib/tracking/tracker";

for (const disabled of [true, false]) {
	test(`tracker ${disabled ? "disables" : "enables"} form and click collection independently of page views`, () => {
		const handlers: string[] = [];
		const scheduled: (() => void)[] = [];
		const requests: string[] = [];
		const tag = { getAttribute: () => (disabled ? "off" : null) };
		const document = {
			querySelector: () => tag,
			currentScript: { getAttribute: () => null },
			cookie: "",
			visibilityState: "visible",
			referrer: "",
			addEventListener: (event: string) => handlers.push(event),
		};
		const location = {
			hostname: "app.speechyou.com",
			pathname: "/sign-in",
			search: "",
			hash: "",
			protocol: "https:",
			origin: "https://app.speechyou.com",
		};
		const history = { pushState: () => {}, replaceState: () => {} };
		const source = trackerSource(
			{
				siteId: "cmp_3163caf5",
				crossDomain: false,
				limitToDomains: false,
				cookieSubdomains: true,
				secureCookies: true,
				honourDnt: false,
				cookieDays: 30,
				hosts: [],
			},
			"https://crm.speechyou.com/api/t/e",
		);
		runInNewContext(source, {
			document,
			window: { location, history, addEventListener: () => {} },
			history,
			navigator: {
				sendBeacon: (url: string) => {
					requests.push(url);
					return true;
				},
			},
			setTimeout: (fn: () => void) => {
				scheduled.push(fn);
				return 1;
			},
			clearTimeout: () => {},
			Blob,
			URL,
		});
		scheduled.shift()?.();
		expect(handlers.includes("submit")).toBe(!disabled);
		expect(handlers.includes("click")).toBe(!disabled);
		scheduled.shift()?.();
		expect(requests).toEqual(["https://crm.speechyou.com/api/t/e"]);
	});
}

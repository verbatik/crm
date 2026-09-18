import { Button } from "@crm/ui/components/button";
import Logo from "@crm/ui/components/logo";
import type { CtaLocation } from "./analytics";
import { BRAND_URL } from "./links";

export function SpeechyouWebsiteButton({
	location,
}: {
	location: CtaLocation;
}) {
	return (
		<Button variant="outline-ghost" size="xl" asChild>
			<a
				href={BRAND_URL}
				target="_blank"
				rel="noreferrer"
				data-location={location}
			>
				<Logo data-icon="inline-start" className="size-6" />
				Visit Speechyou
			</a>
		</Button>
	);
}

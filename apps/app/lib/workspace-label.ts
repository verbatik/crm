export function workspaceLabel(name: string | undefined): string {
	const trimmed = name?.trim();

	if (!trimmed) return "Speechyou CRM";

	return /\bcrm$/i.test(trimmed) ? trimmed : `${trimmed} CRM`;
}

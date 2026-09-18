export const SPEECHYOU_SYNC = {
	batchSize: 50,
	fields: [
		{ key: "speechyou_language", label: "Language", showOnTable: true },
		{ key: "speechyou_domain", label: "Business domain", showOnTable: true },
		{
			key: "speechyou_user_id",
			label: "Speechyou account",
			showOnTable: false,
		},
	],
	languages: {
		en: "English",
		pt: "Portuguese",
		es: "Spanish",
		ja: "Japanese",
		ar: "Arabic",
		fr: "French",
		de: "German",
		it: "Italian",
		nl: "Dutch",
		ru: "Russian",
	},
} as const;

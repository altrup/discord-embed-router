import { parse, stringify, Token } from "path-to-regexp";

// base url is never sent; only used for processing locally
const BASE_URL = "discord://embed.router";

// only what breaks the parse round trip needs escaping: "&"/"=" delimit
// entries, "%" starts an escape, "+" parses back as a space, "#" starts a URL
// fragment, and tab/newline/CR are silently stripped by the URL parser.
// Everything else stays raw to conserve Discord's 100-char customId budget.
const QUERY_ESCAPE_PATTERN = /[%&=+#\t\n\r]/g;
const escapeQueryComponent = (component: string) =>
	component.replace(
		QUERY_ESCAPE_PATTERN,
		// all escaped chars are ASCII, so one %XX byte each
		(char) =>
			`%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
	);

// kinda like a URL but no base_url
export class Location {
	public pathname: string;
	get tokens() {
		return parse(this.pathname).tokens;
	}
	set tokens(tokens: Token[]) {
		this.pathname = stringify({ tokens });
	}

	public queryParams: URLSearchParams;
	get query() {
		const query = [...this.queryParams]
			.map(
				([key, value]) =>
					`${escapeQueryComponent(key)}=${escapeQueryComponent(value)}`,
			)
			.join("&");
		return query.length > 0 ? `?${query}` : "";
	}
	set query(query: string) {
		this.queryParams = new URLSearchParams(query);
	}

	constructor(
		location: string,
		queryParams?: ConstructorParameters<typeof URLSearchParams>[0],
	) {
		const url = new URL(location, BASE_URL);
		// url.search is re-percent-encoded, so its length can't locate the
		// boundary in the raw string; find it directly instead
		const queryIndex = location.indexOf("?");

		this.pathname =
			queryIndex === -1 ? location : location.slice(0, queryIndex);
		this.queryParams = url.searchParams;

		if (queryParams) {
			for (const [key, value] of new URLSearchParams(queryParams)) {
				this.queryParams.append(key, value);
			}
		}
	}

	toString() {
		return `${this.pathname}${this.query}`;
	}
}

/**
 * Host half of the classic QQ 2007 skin.
 *
 * The skin itself is a browser-side presenter: it injects one global stylesheet
 * and one fixed mode switch, then toggles `body[data-dsh-qq-skin]`. The host
 * entry therefore only has to exist so the Loader entry is a valid plugin and
 * so dsh-client-modules can serve `./client`.
 */

/** No Host-side service or model contribution. */
export function apply() {}

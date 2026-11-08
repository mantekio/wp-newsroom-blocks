/**
 * Front end of the Live updates block: keeps each "how long ago" label current, asks the
 * endpoint about newer entries while coverage is live, and shows them without a page reload.
 */
import {
	getContext,
	getElement,
	getServerContext,
	store,
} from '@wordpress/interactivity';

import {
	pluralLabel,
	relativeLabel,
	type PluralLabels,
	type RelativeLabels,
} from './format';

type ContainerContext = {
	endpoint: string;
	// The newest entry on the page.
	latest: number;
	// The newest entry the endpoint has reported.
	newest: number;
	newCount: number;
	isLive: boolean;
	interval: number;
};

type EntryContext = {
	timestamp: number;
};

type Summary = {
	count: number;
	latest: number;
	newer: number;
	isLive: boolean;
};

type ServerState = {
	state: {
		now: number;
		locale: string;
		separator: string;
		labels: PluralLabels;
		relative: RelativeLabels;
	};
};

type Router = typeof import( '@wordpress/interactivity-router' );

/**
 * The query parameter that carries the newest update's time when the page is fetched afresh.
 */
const FRESH = 'live-updates';

const REGION = 'data-wp-router-region';

const nowInSeconds = () => Math.floor( Date.now() / 1000 );

/**
 * Asks the endpoint how many entries are newer than the ones on the page, and whether coverage
 * is still live. Skipped while the tab is hidden, and quietly retried next time if offline.
 *
 * @param context The container's context.
 */
async function check( context: ContainerContext ): Promise< void > {
	if ( document.hidden ) {
		return;
	}
	const url = new URL( context.endpoint );
	url.searchParams.set( 'after', String( context.latest ) );
	try {
		const response = await fetch( url, {
			credentials: 'omit',
			headers: { Accept: 'application/json' },
		} );
		if ( response.status === 404 ) {
			// The post is no longer public, or has no live blog: nothing more will come.
			context.isLive = false;
			return;
		}
		if ( ! response.ok ) {
			return;
		}
		const summary = ( await response.json() ) as Summary;
		context.newCount = summary.newer;
		context.newest = Math.max( context.newest, summary.latest );
		if ( summary.isLive === false ) {
			context.isLive = false;
		}
	} catch {
		// Offline or blocked: the next interval tries again.
	}
}

/**
 * A fresh copy of the page, past any page cache in front of it, or null if it cannot be had.
 *
 * The newest update's time goes in the address. That address is new for every new update, so no
 * cache can answer it with a copy from before the update, yet it is the same for every reader at
 * that moment, so a CDN can still serve them all one copy.
 *
 * @param newest The newest timestamp the endpoint has reported.
 */
async function freshPage( newest: number ): Promise< string | null > {
	const url = new URL( window.location.href );
	url.hash = '';
	url.searchParams.set( FRESH, String( newest ) );
	try {
		const response = await fetch( url, { cache: 'no-store' } );
		const type = response.headers.get( 'content-type' ) ?? '';
		const sameOrigin =
			! response.url ||
			new URL( response.url ).origin === window.location.origin;
		if (
			response.status !== 200 ||
			! sameOrigin ||
			type.split( ';' )[ 0 ].trim().toLowerCase() !== 'text/html'
		) {
			return null;
		}
		return await response.text();
	} catch {
		return null;
	}
}

/**
 * The time of an entry on the page, from its machine-readable date.
 *
 * @param entry An entry's element.
 */
function stampOf( entry: Element ): number {
	const datetime = entry.querySelector( 'time' )?.getAttribute( 'datetime' );
	return datetime ? Date.parse( datetime ) / 1000 : 0;
}

/**
 * The first entry newer than the ones the reader had, once the fresh render is on the page,
 * or the first entry. The router can finish before the page has been updated, so this looks
 * again on each of the next few frames.
 *
 * @param region The router region's ID.
 * @param seen   The newest timestamp the reader had.
 */
function firstNewEntry(
	region: string,
	seen: number
): Promise< HTMLElement | null > {
	return new Promise( ( resolve ) => {
		let frames = 0;
		const look = () => {
			const entries = Array.from(
				document
					.querySelector(
						`[${ REGION }="${ CSS.escape( region ) }"]`
					)
					?.querySelectorAll< HTMLElement >(
						'.wp-block-mantek-live-update'
					) ?? []
			);
			const first = entries.find( ( entry ) => stampOf( entry ) > seen );
			if ( first || ++frames > 30 ) {
				resolve( first ?? entries[ 0 ] ?? null );
				return;
			}
			window.requestAnimationFrame( look );
		};
		look();
	} );
}

const storeDef = {
	state: {
		get relativeTime(): string {
			const { timestamp } = getContext< EntryContext >();
			return timestamp > 0
				? relativeLabel(
						state.now - timestamp,
						state.relative,
						state.locale,
						state.separator
					)
				: '';
		},
		get newLabel(): string {
			const { newCount } = getContext< ContainerContext >();
			return newCount > 0
				? pluralLabel(
						state.labels,
						newCount,
						state.locale,
						state.separator
					)
				: '';
		},
	},
	actions: {
		// The router swaps in this block's fresh render; the rest of the page stays put. The
		// button that was used then disappears, so focus moves to the first new entry.
		*showNew(): Generator< unknown, void, unknown > {
			const context = getContext< ContainerContext >();
			const region = getElement()
				.ref?.closest( `[${ REGION }]` )
				?.getAttribute( REGION );
			const seen = context.latest;

			const html = ( yield freshPage( context.newest ) ) as string | null;
			if ( ! html ) {
				// The button stays, so the reader can try again.
				return;
			}
			const router =
				( yield import( '@wordpress/interactivity-router' ) ) as Router;
			yield router.actions.navigate( window.location.href, {
				force: true,
				replace: true,
				html,
				// Focus moves to the new entry, which is announced in its place.
				screenReaderAnnouncement: false,
			} );

			if ( region ) {
				const entry = ( yield firstNewEntry(
					region,
					seen
				) ) as HTMLElement | null;
				entry?.focus();
			}
		},
	},
	callbacks: {
		// Keeps the "how long ago" labels current, counting from the reader's clock rather than
		// the moment the page was rendered, which a page cache can make minutes old.
		startClock(): () => void {
			state.now = nowInSeconds();
			const clock = window.setInterval( () => {
				state.now = nowInSeconds();
			}, 30_000 );
			return () => window.clearInterval( clock );
		},
		// Checks for new entries while coverage is live. This runs again whenever isLive changes,
		// and the cleanup clears the timer, so the checking stops once coverage ends.
		poll(): ( () => void ) | undefined {
			const context = getContext< ContainerContext >();
			if ( ! context.isLive ) {
				return undefined;
			}
			const timer = window.setInterval(
				() => void check( context ),
				context.interval * 1000
			);
			return () => window.clearInterval( timer );
		},
		// The router keeps the browser's context when it swaps in a fresh render, so what the
		// server knows is copied from its copy: the newest entry, the pending count, whether
		// coverage is live and how often to check. This reads only the server's copy, so it runs
		// on load and again after every navigation that changes it.
		syncFromServer(): void {
			const fresh = getServerContext< ContainerContext >();
			const context = getContext< ContainerContext >();
			context.latest = fresh.latest;
			context.newest = fresh.newest;
			context.newCount = fresh.newCount;
			context.isLive = fresh.isLive;
			context.interval = fresh.interval;
		},
	},
};

type Store = ServerState & typeof storeDef;

const { state } = store< Store >( 'mantek/live-updates', storeDef );

/**
 * Front end of the Live updates block: keeps each "how long ago" label current, and when
 * the endpoint reports newer entries, offers them without a full page reload.
 */
import { getContext, getServerContext, store } from '@wordpress/interactivity';

import { formatRelative, pluralLabel, withWesternDigits } from './format';

type ContainerContext = {
	endpoint: string;
	latest: number;
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
};

type ServerState = {
	state: {
		now: number;
		labels: Record< string, string >;
	};
};

type Router = typeof import( '@wordpress/interactivity-router' );

const locale = () => withWesternDigits( document.documentElement.lang );

/**
 * Asks the endpoint how many entries are newer than the ones on the page.
 * Skipped while the tab is hidden, and quietly retried next time if offline.
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
		if ( response.ok ) {
			const summary = ( await response.json() ) as Summary;
			context.newCount = summary.newer;
		}
	} catch {
		// Offline or blocked: the next interval tries again.
	}
}

const storeDef = {
	state: {
		get relativeTime(): string {
			const { timestamp } = getContext< EntryContext >();
			return timestamp > 0
				? formatRelative( timestamp, state.now, locale() )
				: '';
		},
		get newLabel(): string {
			const { newCount } = getContext< ContainerContext >();
			return newCount > 0
				? pluralLabel( state.labels, newCount, locale() )
				: '';
		},
	},
	actions: {
		// The router swaps in this block's fresh server render; the rest of the page stays put.
		*showNew(): Generator< unknown, void, unknown > {
			const router =
				( yield import( '@wordpress/interactivity-router' ) ) as Router;
			yield router.actions.navigate( window.location.href, {
				force: true,
				replace: true,
			} );
		},
	},
	callbacks: {
		start(): () => void {
			const context = getContext< ContainerContext >();
			const clock = window.setInterval( () => {
				state.now = Math.floor( Date.now() / 1000 );
			}, 30_000 );
			const poll = context.isLive
				? window.setInterval(
						() => void check( context ),
						context.interval * 1000
					)
				: 0;
			return () => {
				window.clearInterval( clock );
				window.clearInterval( poll );
			};
		},
		// The router keeps the browser's context when it swaps in a fresh render, so
		// the newest timestamp and the pending count are taken from the server's copy.
		// This runs on load and again after every navigation that changes that copy.
		syncFromServer(): void {
			const fresh = getServerContext< ContainerContext >();
			const context = getContext< ContainerContext >();
			context.latest = fresh.latest;
			context.newCount = fresh.newCount;
		},
	},
};

type Store = ServerState & typeof storeDef;

const { state } = store< Store >( 'mantek/live-updates', storeDef );

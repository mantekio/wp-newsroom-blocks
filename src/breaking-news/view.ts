/**
 * Front end of the Breaking news bar: times the scroll to the headlines' width, holds still when
 * they fit, and runs the pause and close buttons. Without JavaScript the bar still scrolls, and
 * pauses on hover and focus.
 */
import { getContext, getElement, store } from '@wordpress/interactivity';

import { scrollDuration } from './motion';

type Context = {
	paused: boolean;
	dismissed: boolean;
	still: boolean;
	speed: number;
};

const FOCUSABLE = [
	'a[href]',
	'area[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'summary',
	'iframe',
	'[contenteditable]:not([contenteditable="false"])',
	'[tabindex]',
].join( ',' );

/**
 * Where keyboard focus goes when the bar closes: the next element after it that a reader can
 * tab to, or failing that, the last one before it.
 *
 * @param bar The bar.
 */
function focusAfter( bar: HTMLElement ): HTMLElement | null {
	const candidates = Array.from(
		document.querySelectorAll< HTMLElement >( FOCUSABLE )
	).filter(
		( element ) =>
			! bar.contains( element ) &&
			element.tabIndex >= 0 &&
			element.getClientRects().length > 0
	);
	// Elements inside the bar are already left out, so these are the only two positions left.
	const position = ( element: HTMLElement ) =>
		bar.compareDocumentPosition( element );
	return (
		candidates.find(
			( element ) =>
				position( element ) === Node.DOCUMENT_POSITION_FOLLOWING
		) ??
		candidates
			.reverse()
			.find(
				( element ) =>
					position( element ) === Node.DOCUMENT_POSITION_PRECEDING
			) ??
		null
	);
}

const { state } = store( 'mantek/breaking-news', {
	state: {
		isReady: false,
	},
	actions: {
		togglePause() {
			const context = getContext< Context >();
			context.paused = ! context.paused;
		},
		// The close button goes with the bar, so focus moves on rather than dropping to the page.
		dismiss() {
			const bar = getElement().ref?.closest< HTMLElement >(
				'.wp-block-mantek-breaking-news'
			);
			const target =
				bar && bar.contains( bar.ownerDocument.activeElement )
					? focusAfter( bar )
					: null;
			getContext< Context >().dismissed = true;
			target?.focus();
		},
	},
	callbacks: {
		measure(): ( () => void ) | undefined {
			const { ref } = getElement();
			state.isReady = true;

			const viewport = ref?.querySelector< HTMLElement >(
				'.wp-block-mantek-breaking-news__viewport'
			);
			const track = viewport?.querySelector< HTMLElement >(
				'.wp-block-mantek-breaking-news__track'
			);
			if ( ! ref || ! viewport || ! track ) {
				return undefined;
			}

			const context = getContext< Context >();

			const update = () => {
				// Headlines that fit hold still. Scrolled, they would show beside their own copy,
				// then a gap until the loop restarts.
				const gap =
					parseFloat( getComputedStyle( track ).paddingInlineEnd ) ||
					0;
				context.still = track.scrollWidth - gap <= viewport.clientWidth;
				ref.style.setProperty(
					'--mantek-breaking-duration',
					`${ scrollDuration( track.scrollWidth, context.speed ) }s`
				);
			};
			update();

			// Web fonts and resizes change the widths, and with them the duration.
			const observer = new ResizeObserver( update );
			observer.observe( track );
			observer.observe( viewport );
			return () => observer.disconnect();
		},
	},
} );

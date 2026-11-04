/**
 * Front end of the Breaking news bar: times the scroll to the headlines' width, and runs the
 * pause and close buttons. Without JavaScript the bar still scrolls, and pauses on hover and focus.
 */
import { getContext, getElement, store } from '@wordpress/interactivity';

import { scrollDuration } from './motion';

type Context = {
	paused: boolean;
	dismissed: boolean;
	speed: number;
};

const { state } = store( 'mantek/breaking-news', {
	state: {
		isReady: false,
	},
	actions: {
		togglePause() {
			const context = getContext< Context >();
			context.paused = ! context.paused;
		},
		dismiss() {
			getContext< Context >().dismissed = true;
		},
	},
	callbacks: {
		measure(): ( () => void ) | undefined {
			const { ref } = getElement();
			state.isReady = true;

			const track = ref?.querySelector< HTMLElement >(
				'.wp-block-mantek-breaking-news__track'
			);
			if ( ! ref || ! track ) {
				return undefined;
			}

			const { speed } = getContext< Context >();

			const update = () =>
				ref.style.setProperty(
					'--mantek-breaking-duration',
					`${ scrollDuration( track.scrollWidth, speed ) }s`
				);
			update();

			// Web fonts and resizes change the width, and with it the duration.
			const observer = new ResizeObserver( update );
			observer.observe( track );
			return () => observer.disconnect();
		},
	},
} );

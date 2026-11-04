/**
 * Saved markup for one timeline event. A machine-readable date goes in <time datetime>,
 * so search engines and assistive technology get the real date whatever the label says.
 */
import {
	RichText,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import type { BlockSaveProps } from '@wordpress/blocks';

import type { Attributes } from './edit';

export default function save( { attributes }: BlockSaveProps< Attributes > ) {
	const { datetime, label, heading } = attributes;
	const blockProps = useBlockProps.save();
	const innerBlocksProps = useInnerBlocksProps.save( {
		className: 'wp-block-mantek-timeline-event__content',
	} );

	return (
		<li { ...blockProps }>
			{ label &&
				( datetime ? (
					<RichText.Content
						tagName="time"
						className="wp-block-mantek-timeline-event__time"
						dateTime={ datetime }
						value={ label }
					/>
				) : (
					<RichText.Content
						tagName="span"
						className="wp-block-mantek-timeline-event__time"
						value={ label }
					/>
				) ) }
			{ heading && (
				<RichText.Content
					tagName="h3"
					className="wp-block-mantek-timeline-event__heading"
					value={ heading }
				/>
			) }
			<div { ...innerBlocksProps } />
		</li>
	);
}

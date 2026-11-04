/**
 * Editor UI for the Story timeline block: an ordered list that only accepts timeline events.
 */
import {
	InnerBlocks,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';

import type { BlockTemplate } from '../shared/types';

const EVENT = 'mantek/timeline-event';
const TEMPLATE: BlockTemplate = [ [ EVENT ], [ EVENT ] ];

export default function Edit() {
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps( blockProps, {
		allowedBlocks: [ EVENT ],
		template: TEMPLATE,
		renderAppender: InnerBlocks.ButtonBlockAppender,
	} );

	return <ol { ...innerBlocksProps } />;
}

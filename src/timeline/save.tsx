/**
 * Saved markup for the Story timeline block: an ordered list of events.
 */
import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';

export default function save() {
	return <ol { ...useInnerBlocksProps.save( useBlockProps.save() ) } />;
}

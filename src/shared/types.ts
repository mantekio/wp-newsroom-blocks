/**
 * Types shared by the blocks.
 */
import type { useInnerBlocksProps } from '@wordpress/block-editor';

/**
 * An inner-blocks template, as `useInnerBlocksProps` accepts it. The packages do not export this type.
 */
export type BlockTemplate = NonNullable<
	NonNullable< Parameters< typeof useInnerBlocksProps >[ 1 ] >[ 'template' ]
>;

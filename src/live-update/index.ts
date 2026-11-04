/**
 * Live update: one timestamped entry inside a Live updates block.
 */
import { registerBlockType, type BlockConfiguration } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { createElement } from '@wordpress/element';
import { scheduled } from '@wordpress/icons';

import metadata from './block.json';
import Edit, { type Attributes } from './edit';

registerBlockType< Attributes >(
	metadata as unknown as BlockConfiguration< Attributes >,
	{
		icon: scheduled,
		edit: Edit,
		// Only the content is saved; the server renders the time from the timestamp attribute.
		save: () => createElement( InnerBlocks.Content ),
	}
);

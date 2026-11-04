/**
 * Timeline event: one dated moment inside a Story timeline.
 */
import { registerBlockType, type BlockConfiguration } from '@wordpress/blocks';
import { postDate } from '@wordpress/icons';

import metadata from './block.json';
import Edit, { type Attributes } from './edit';
import save from './save';

registerBlockType< Attributes >(
	metadata as unknown as BlockConfiguration< Attributes >,
	{
		icon: postDate,
		edit: Edit,
		save,
	}
);

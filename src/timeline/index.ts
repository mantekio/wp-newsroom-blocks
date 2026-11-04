/**
 * Story timeline: a list of dated events, saved as plain HTML so it outlives the plugin.
 */
import { registerBlockType, type BlockConfiguration } from '@wordpress/blocks';
import { list } from '@wordpress/icons';

import metadata from './block.json';
import Edit from './edit';
import save from './save';
import './style.scss';

registerBlockType( metadata as unknown as BlockConfiguration, {
	icon: list,
	edit: Edit,
	save,
} );

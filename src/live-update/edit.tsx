/**
 * Editor UI for one live update: stamped by its Live updates block with the time it got its
 * first content, which editors can change, and optionally marked as a key update.
 */
import { __ } from '@wordpress/i18n';
import {
	BlockControls,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import {
	DateTimePicker,
	Dropdown,
	ToolbarButton,
	ToolbarGroup,
} from '@wordpress/components';
import { date, dateI18n, getDate, getSettings } from '@wordpress/date';
import { scheduled, starEmpty, starFilled } from '@wordpress/icons';

import type { BlockTemplate } from '../shared/types';

export type Attributes = {
	timestamp: number;
	important: boolean;
};

const ALLOWED_BLOCKS = [
	'core/paragraph',
	'core/heading',
	'core/list',
	'core/image',
	'core/gallery',
	'core/quote',
	'core/embed',
	'core/video',
];

const TEMPLATE: BlockTemplate = [
	[
		'core/paragraph',
		{ placeholder: __( 'What is the latest?', 'wp-newsroom-blocks' ) },
	],
];

export default function Edit( {
	attributes,
	setAttributes,
}: BlockEditProps< Attributes > ) {
	const { timestamp, important } = attributes;
	const { formats } = getSettings();

	const blockProps = useBlockProps( {
		className: important ? 'is-important' : undefined,
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wp-block-mantek-live-update__content' },
		{ allowedBlocks: ALLOWED_BLOCKS, template: TEMPLATE }
	);

	// The picker works in the site's timezone; the attribute stores Unix time.
	const onTimeChange = ( value: string | null ) => {
		if ( value ) {
			setAttributes( {
				timestamp: Math.floor( getDate( value ).getTime() / 1000 ),
			} );
		}
	};

	return (
		<>
			<BlockControls>
				<ToolbarGroup>
					<Dropdown
						popoverProps={ { placement: 'bottom-start' } }
						renderToggle={ ( { isOpen, onToggle } ) => (
							<ToolbarButton
								icon={ scheduled }
								label={ __(
									'Change the time',
									'wp-newsroom-blocks'
								) }
								onClick={ onToggle }
								aria-expanded={ isOpen }
							/>
						) }
						renderContent={ () => (
							<DateTimePicker
								currentDate={
									timestamp
										? date(
												'Y-m-d\\TH:i:s',
												timestamp * 1000,
												undefined
											)
										: null
								}
								onChange={ onTimeChange }
								is12Hour={ /a(?!\\)/i.test( formats.time ) }
							/>
						) }
					/>
					<ToolbarButton
						icon={ important ? starFilled : starEmpty }
						label={
							important
								? __(
										'Unmark as a key update',
										'wp-newsroom-blocks'
									)
								: __(
										'Mark as a key update',
										'wp-newsroom-blocks'
									)
						}
						isPressed={ important }
						onClick={ () =>
							setAttributes( { important: ! important } )
						}
					/>
				</ToolbarGroup>
			</BlockControls>

			<article { ...blockProps }>
				<header className="wp-block-mantek-live-update__meta">
					{ timestamp > 0 && (
						<time
							className="wp-block-mantek-live-update__time"
							dateTime={ new Date(
								timestamp * 1000
							).toISOString() }
						>
							{ dateI18n(
								`${ formats.date } ${ formats.time }`,
								timestamp * 1000,
								undefined
							) }
						</time>
					) }
					{ important && (
						<span className="wp-block-mantek-live-update__key">
							{ __( 'Key update', 'wp-newsroom-blocks' ) }
						</span>
					) }
				</header>
				<div { ...innerBlocksProps } />
			</article>
		</>
	);
}

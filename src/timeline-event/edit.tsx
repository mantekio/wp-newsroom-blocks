/**
 * Editor UI for one timeline event: a date picker that fills in a label editors can rewrite
 * ("Morning", "Day 2"), a heading, and free content underneath.
 */
import { __ } from '@wordpress/i18n';
import {
	BlockControls,
	RichText,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import {
	Button,
	DateTimePicker,
	Dropdown,
	ToolbarButton,
	ToolbarGroup,
} from '@wordpress/components';
import { dateI18n, getDate, getSettings } from '@wordpress/date';
import { calendar } from '@wordpress/icons';

import type { BlockTemplate } from '../shared/types';

export type Attributes = {
	datetime: string;
	label: string;
	heading: string;
};

const ALLOWED_BLOCKS = [
	'core/paragraph',
	'core/list',
	'core/image',
	'core/quote',
	'core/embed',
];

const TEMPLATE: BlockTemplate = [
	[
		'core/paragraph',
		{ placeholder: __( 'What happened?', 'wp-newsroom-blocks' ) },
	],
];

export default function Edit( {
	attributes,
	setAttributes,
}: BlockEditProps< Attributes > ) {
	const { datetime, label, heading } = attributes;
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wp-block-mantek-timeline-event__content' },
		{ allowedBlocks: ALLOWED_BLOCKS, template: TEMPLATE }
	);
	const { formats } = getSettings();

	const onDateChange = ( value: string | null ) => {
		if ( ! value ) {
			setAttributes( { datetime: '' } );
			return;
		}
		// The picker's value has no timezone and means the site's, which getDate() applies.
		// Read without it, the browser would take it as its own local time, and a pick near
		// midnight would be labelled with the neighbouring day.
		setAttributes( {
			datetime: value,
			label: dateI18n( formats.date, getDate( value ) ),
		} );
	};

	return (
		<>
			<BlockControls>
				<ToolbarGroup>
					<Dropdown
						popoverProps={ { placement: 'bottom-start' } }
						renderToggle={ ( { isOpen, onToggle } ) => (
							<ToolbarButton
								icon={ calendar }
								label={ __(
									'Set the date',
									'wp-newsroom-blocks'
								) }
								onClick={ onToggle }
								aria-expanded={ isOpen }
								isPressed={ !! datetime }
							/>
						) }
						renderContent={ () => (
							<div className="wp-block-mantek-timeline-event__picker">
								<DateTimePicker
									currentDate={ datetime || null }
									onChange={ onDateChange }
									is12Hour={ /a(?!\\)/i.test( formats.time ) }
								/>
								{ datetime && (
									<Button
										variant="link"
										isDestructive
										onClick={ () =>
											setAttributes( { datetime: '' } )
										}
									>
										{ __(
											'Remove the date',
											'wp-newsroom-blocks'
										) }
									</Button>
								) }
							</div>
						) }
					/>
				</ToolbarGroup>
			</BlockControls>

			<li { ...blockProps }>
				<RichText
					tagName={ datetime ? 'time' : 'span' }
					className="wp-block-mantek-timeline-event__time"
					value={ label }
					onChange={ ( value: string ) =>
						setAttributes( { label: value } )
					}
					placeholder={ __( 'Date or time', 'wp-newsroom-blocks' ) }
					allowedFormats={ [] }
					disableLineBreaks
				/>
				<RichText
					tagName="h3"
					className="wp-block-mantek-timeline-event__heading"
					value={ heading }
					onChange={ ( value: string ) =>
						setAttributes( { heading: value } )
					}
					placeholder={ __(
						'What happened, in a few words',
						'wp-newsroom-blocks'
					) }
					allowedFormats={ [
						'core/bold',
						'core/italic',
						'core/link',
					] }
				/>
				<div { ...innerBlocksProps } />
			</li>
		</>
	);
}

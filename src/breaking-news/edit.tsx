/**
 * Editor UI for the Breaking news bar: choose the category and how fresh a headline must be,
 * and preview what readers would see right now. The preview does not scroll.
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	InspectorControls,
	RichText,
	useBlockProps,
} from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import {
	PanelBody,
	RangeControl,
	SelectControl,
	Spinner,
} from '@wordpress/components';
import { store as coreStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';

import { titleText } from '../shared/title';
import './editor.scss';

export type Attributes = {
	label: string;
	categoryId: number;
	count: number;
	maxAgeHours: number;
	speed: number;
};

type Term = {
	id: number;
	name: string;
};

type PostRecord = {
	id: number;
	title: { rendered: string };
};

export default function Edit( {
	attributes,
	setAttributes,
}: BlockEditProps< Attributes > ) {
	const { label, categoryId, count, maxAgeHours, speed } = attributes;

	// The view context, which every author can read. In the editor's default, edit, categories
	// need manage_categories and posts are limited to the ones the current user may edit.
	const categories = useSelect(
		( select ) =>
			( select( coreStore ).getEntityRecords( 'taxonomy', 'category', {
				context: 'view',
				per_page: 100,
				orderby: 'name',
				_fields: 'id,name',
			} ) ?? [] ) as Term[],
		[]
	);

	// Rounded to the minute, like the server, so the query is not re-run on every render.
	const after = useMemo(
		() =>
			new Date(
				Math.floor( Date.now() / 60_000 ) * 60_000 -
					maxAgeHours * 3_600_000
			).toISOString(),
		[ maxAgeHours ]
	);

	const { posts, loading } = useSelect(
		( select ) => {
			const query = {
				context: 'view' as const,
				per_page: count,
				after,
				_fields: 'id,title',
				...( categoryId ? { categories: [ categoryId ] } : {} ),
			};
			return {
				posts: ( select( coreStore ).getEntityRecords(
					'postType',
					'post',
					query
				) ?? [] ) as PostRecord[],
				loading: ! select( coreStore ).hasFinishedResolution(
					'getEntityRecords',
					[ 'postType', 'post', query ]
				),
			};
		},
		[ count, after, categoryId ]
	);

	const blockProps = useBlockProps( { className: 'is-preview' } );

	return (
		<>
			<InspectorControls>
				<PanelBody
					title={ __( 'Headlines', 'mantek-newsroom-blocks' ) }
				>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Category', 'mantek-newsroom-blocks' ) }
						value={ String( categoryId ) }
						options={ [
							{
								label: __(
									'All categories',
									'mantek-newsroom-blocks'
								),
								value: '0',
							},
							...categories.map( ( term ) => ( {
								label: decodeEntities( term.name ),
								value: String( term.id ),
							} ) ),
						] }
						onChange={ ( value: string ) =>
							setAttributes( { categoryId: Number( value ) } )
						}
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Number of headlines',
							'mantek-newsroom-blocks'
						) }
						min={ 1 }
						max={ 10 }
						value={ count }
						onChange={ ( value ) =>
							setAttributes( { count: value ?? 5 } )
						}
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Only posts from the last (hours)',
							'mantek-newsroom-blocks'
						) }
						help={ __(
							'With nothing that recent, the bar is not shown at all.',
							'mantek-newsroom-blocks'
						) }
						min={ 1 }
						max={ 168 }
						value={ maxAgeHours }
						onChange={ ( value ) =>
							setAttributes( { maxAgeHours: value ?? 24 } )
						}
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Scroll speed (pixels per second)',
							'mantek-newsroom-blocks'
						) }
						min={ 20 }
						max={ 200 }
						step={ 10 }
						value={ speed }
						onChange={ ( value ) =>
							setAttributes( { speed: value ?? 60 } )
						}
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				<RichText
					tagName="strong"
					className="wp-block-mantek-breaking-news__label"
					value={ label }
					onChange={ ( value: string ) =>
						setAttributes( { label: value } )
					}
					placeholder={ __( 'Breaking', 'mantek-newsroom-blocks' ) }
					allowedFormats={ [] }
					disableLineBreaks
				/>
				<div className="wp-block-mantek-breaking-news__viewport">
					{ loading && <Spinner /> }
					{ ! loading && posts.length > 0 && (
						<ul className="wp-block-mantek-breaking-news__track">
							{ posts.map( ( post ) => (
								<li
									key={ post.id }
									className="wp-block-mantek-breaking-news__item"
								>
									{ titleText( post.title.rendered ) }
								</li>
							) ) }
						</ul>
					) }
					{ ! loading && posts.length === 0 && (
						<p className="wp-block-mantek-breaking-news__empty">
							{ sprintf(
								/* translators: %d: number of hours. */
								_n(
									'Nothing published in the last %d hour, so the bar is hidden on the site for now.',
									'Nothing published in the last %d hours, so the bar is hidden on the site for now.',
									maxAgeHours,
									'mantek-newsroom-blocks'
								),
								maxAgeHours
							) }
						</p>
					) }
				</div>
			</div>
		</>
	);
}

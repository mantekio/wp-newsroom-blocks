<?php
/**
 * Server rendering for the Read also block.
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks;

use WP_Block;
use WP_Post;

/**
 * Renders a short list of related articles chosen in the editor.
 */
final class ReadAlso {

	/**
	 * The most links one block shows. The editor enforces the same limit.
	 */
	public const MAX_POSTS = 5;

	/**
	 * Renders the block on the front end. Returns nothing when none of the chosen articles is published.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param WP_Block|null        $block      Block instance, which carries the current post ID.
	 */
	public static function render( array $attributes, ?WP_Block $block = null ): string {
		$current_id = isset( $block->context['postId'] ) ? (int) $block->context['postId'] : 0;
		$ids        = self::post_ids( $attributes['postIds'] ?? array(), $current_id );
		if ( array() === $ids ) {
			return '';
		}

		$show_thumbnails = ! empty( $attributes['showThumbnails'] );

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- query_args() sets suppress_filters to false, so the query is cached.
		$posts = get_posts( self::query_args( $ids, $show_thumbnails ) );
		if ( array() === $posts ) {
			return '';
		}

		$heading = trim( wp_strip_all_tags( (string) ( $attributes['heading'] ?? '' ) ) );
		if ( '' === $heading ) {
			$heading = __( 'Read also', 'wp-newsroom-blocks' );
		}

		$items = '';
		foreach ( $posts as $post ) {
			$items .= self::item( $post, $show_thumbnails );
		}

		$heading_id = wp_unique_id( 'wp-block-mantek-read-also-' );

		return sprintf(
			'<aside %1$s aria-labelledby="%2$s"><p class="wp-block-mantek-read-also__heading" id="%2$s">%3$s</p><ul class="wp-block-mantek-read-also__list">%4$s</ul></aside>',
			get_block_wrapper_attributes(),
			esc_attr( $heading_id ),
			esc_html( $heading ),
			$items
		);
	}

	/**
	 * Cleans the stored IDs: positive integers, no duplicates, never the current post, at most MAX_POSTS.
	 *
	 * @param mixed $raw        The postIds attribute as stored.
	 * @param int   $exclude_id The post being displayed, which should not link to itself.
	 * @return list<int>
	 */
	public static function post_ids( mixed $raw, int $exclude_id = 0 ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}

		$ids = array();
		foreach ( $raw as $value ) {
			$id = is_numeric( $value ) ? (int) $value : 0;
			if ( $id > 0 && $id !== $exclude_id && ! in_array( $id, $ids, true ) ) {
				$ids[] = $id;
			}
		}

		return array_slice( $ids, 0, self::MAX_POSTS );
	}

	/**
	 * Query arguments that fetch the chosen articles, published ones only, in the order the editor set.
	 *
	 * @param list<int> $ids             Clean post IDs.
	 * @param bool      $with_thumbnails Whether featured images are shown, the only thing that reads post meta.
	 * @return array{post__in: list<int>, orderby: 'post__in', post_type: 'post', post_status: 'publish', posts_per_page: int, ignore_sticky_posts: true, no_found_rows: true, update_post_meta_cache: bool, suppress_filters: false, fields: 'all'}
	 */
	public static function query_args( array $ids, bool $with_thumbnails = false ): array {
		return array(
			'post__in'               => $ids,
			'orderby'                => 'post__in',
			'post_type'              => 'post',
			'post_status'            => 'publish',
			'posts_per_page'         => count( $ids ),
			'ignore_sticky_posts'    => true,
			'no_found_rows'          => true,
			'update_post_meta_cache' => $with_thumbnails,
			'suppress_filters'       => false,
			'fields'                 => 'all',
		);
	}

	/**
	 * One list item: a single link around the optional thumbnail and the title.
	 *
	 * @param WP_Post $post            The linked article.
	 * @param bool    $show_thumbnails Whether to include the featured image.
	 */
	private static function item( WP_Post $post, bool $show_thumbnails ): string {
		$thumbnail = '';
		if ( $show_thumbnails ) {
			// The title follows inside the same link, so the image is decorative.
			$thumbnail = get_the_post_thumbnail(
				$post,
				'thumbnail',
				array(
					'class'   => 'wp-block-mantek-read-also__thumbnail',
					'alt'     => '',
					'loading' => 'lazy',
				)
			);
		}

		return sprintf(
			'<li class="wp-block-mantek-read-also__item"><a class="wp-block-mantek-read-also__link" href="%1$s">%2$s<span class="wp-block-mantek-read-also__title">%3$s</span></a></li>',
			esc_url( (string) get_permalink( $post ) ),
			$thumbnail,
			Plugin::title_html( $post )
		);
	}
}

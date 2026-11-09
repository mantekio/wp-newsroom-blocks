<?php
/**
 * Server rendering for the Breaking news bar block.
 *
 * @package mantek-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks;

/**
 * Renders a scrolling strip of the newest headlines, and nothing at all when there are none.
 */
final class BreakingNews {

	/**
	 * Interactivity API store namespace.
	 */
	public const STORE = 'mantek/breaking-news';

	/**
	 * The most headlines one bar shows.
	 */
	public const MAX_ITEMS = 10;

	/**
	 * The longest look-back, one week, in hours.
	 */
	public const MAX_AGE_HOURS = 168;

	/**
	 * Renders the block on the front end.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 */
	public static function render( array $attributes ): string {
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- query_args() sets suppress_filters to false, so the query is cached.
		$posts = get_posts( self::query_args( $attributes, time() ) );
		if ( array() === $posts ) {
			return '';
		}

		$label = trim( wp_strip_all_tags( (string) ( $attributes['label'] ?? '' ) ) );
		if ( '' === $label ) {
			$label = __( 'Breaking', 'mantek-newsroom-blocks' );
		}

		$speed = self::speed( $attributes['speed'] ?? 60 );
		$items = '';
		$copy  = '';
		foreach ( $posts as $post ) {
			$url    = esc_url( (string) get_permalink( $post ) );
			$title  = Plugin::title_html( $post );
			$items .= sprintf( '<li class="wp-block-mantek-breaking-news__item"><a href="%1$s">%2$s</a></li>', $url, $title );
			// The second copy makes the loop seamless. It is hidden from assistive technology and the tab order.
			$copy .= sprintf( '<li class="wp-block-mantek-breaking-news__item"><a href="%1$s" tabindex="-1">%2$s</a></li>', $url, $title );
		}

		// The pause and close buttons need JavaScript, so they stay hidden until the store is ready.
		wp_interactivity_state( self::STORE, array( 'isReady' => false ) );

		return sprintf(
			'<div %1$s role="region" aria-label="%2$s" data-wp-interactive="%3$s" %4$s data-wp-init="callbacks.measure" data-wp-class--is-paused="context.paused" data-wp-class--is-still="context.still" data-wp-bind--hidden="context.dismissed">'
				. '<strong class="wp-block-mantek-breaking-news__label">%5$s</strong>'
				. '<div class="wp-block-mantek-breaking-news__viewport">'
				. '<ul class="wp-block-mantek-breaking-news__track">%6$s</ul>'
				. '<ul class="wp-block-mantek-breaking-news__track" aria-hidden="true">%7$s</ul>'
				. '</div>'
				. '<button type="button" class="wp-block-mantek-breaking-news__pause" aria-label="%8$s" aria-pressed="false" hidden data-wp-bind--hidden="!state.isReady" data-wp-bind--aria-pressed="context.paused" data-wp-on-async--click="actions.togglePause"></button>'
				. '<button type="button" class="wp-block-mantek-breaking-news__close" aria-label="%9$s" hidden data-wp-bind--hidden="!state.isReady" data-wp-on-async--click="actions.dismiss"></button>'
				. '</div>',
			get_block_wrapper_attributes( array( 'style' => sprintf( '--mantek-breaking-speed:%d;', $speed ) ) ),
			esc_attr( $label ),
			esc_attr( self::STORE ),
			wp_interactivity_data_wp_context(
				array(
					'paused'    => false,
					'dismissed' => false,
					// Set in the browser when the headlines fit without scrolling.
					'still'     => false,
					'speed'     => $speed,
				)
			),
			esc_html( $label ),
			$items,
			$copy,
			esc_attr__( 'Pause the headlines', 'mantek-newsroom-blocks' ),
			esc_attr__( 'Close the breaking news bar', 'mantek-newsroom-blocks' )
		);
	}

	/**
	 * Query arguments for the newest headlines in the chosen category.
	 *
	 * The cut-off is rounded down to the minute so every page view within that minute
	 * runs an identical query, which the object cache can then serve.
	 *
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param int                  $now        Current Unix time.
	 * @return array{post_type: 'post', post_status: 'publish', posts_per_page: int, orderby: 'date', order: 'DESC', ignore_sticky_posts: true, no_found_rows: true, update_post_meta_cache: false, suppress_filters: false, fields: 'all', date_query: list<array{column: 'post_date_gmt', after: string, inclusive: true}>, cat?: int}
	 */
	public static function query_args( array $attributes, int $now ): array {
		$count = min( self::MAX_ITEMS, max( 1, (int) ( $attributes['count'] ?? 5 ) ) );
		$hours = min( self::MAX_AGE_HOURS, max( 1, (int) ( $attributes['maxAgeHours'] ?? 24 ) ) );
		$since = $now - ( $now % MINUTE_IN_SECONDS ) - $hours * HOUR_IN_SECONDS;

		$args = array(
			'post_type'              => 'post',
			'post_status'            => 'publish',
			'posts_per_page'         => $count,
			'orderby'                => 'date',
			'order'                  => 'DESC',
			'ignore_sticky_posts'    => true,
			'no_found_rows'          => true,
			// The bar shows titles and links only, so post meta is never read.
			'update_post_meta_cache' => false,
			'suppress_filters'       => false,
			'fields'                 => 'all',
			'date_query'             => array(
				array(
					'column'    => 'post_date_gmt',
					'after'     => gmdate( 'Y-m-d H:i:s', $since ),
					'inclusive' => true,
				),
			),
		);

		$category = (int) ( $attributes['categoryId'] ?? 0 );
		if ( $category > 0 ) {
			$args['cat'] = $category;
		}

		return $args;
	}

	/**
	 * Scroll speed in pixels per second, kept within a readable range.
	 *
	 * @param mixed $value The speed attribute as stored.
	 */
	public static function speed( mixed $value ): int {
		return min( 200, max( 20, is_numeric( $value ) ? (int) $value : 60 ) );
	}
}

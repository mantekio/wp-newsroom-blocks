<?php
/**
 * Tests for the Live updates blocks and their polling endpoint.
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks\Tests;

use Brain\Monkey\Functions;
use ManTek\NewsroomBlocks\LiveUpdates;
use WP_Block;
use WP_Error;
use WP_Post;
use WP_REST_Request;

final class LiveUpdatesTest extends TestCase {

	/**
	 * A live blog with three entries, the newest first, as parse_blocks() returns it.
	 *
	 * @return array<string, mixed>
	 */
	private function container(): array {
		return array(
			'blockName'   => 'mantek/live-updates',
			'attrs'       => array(),
			'innerBlocks' => array(
				array(
					'blockName' => 'mantek/live-update',
					'attrs'     => array( 'timestamp' => 300 ),
				),
				array(
					'blockName' => 'mantek/live-update',
					'attrs'     => array( 'timestamp' => 200 ),
				),
				array(
					'blockName' => 'mantek/live-update',
					'attrs'     => array( 'timestamp' => 100 ),
				),
			),
		);
	}

	public function test_summary_counts_entries_and_finds_the_newest(): void {
		$this->assertSame(
			array(
				'count'  => 3,
				'latest' => 300,
				'newer'  => 0,
			),
			LiveUpdates::summarize( array( 300, 200, 100 ), 0 )
		);
	}

	public function test_summary_counts_only_entries_newer_than_the_reader_has(): void {
		$this->assertSame( 2, LiveUpdates::summarize( array( 300, 200, 100 ), 100 )['newer'] );
		$this->assertSame( 0, LiveUpdates::summarize( array( 300 ), 300 )['newer'] );
	}

	public function test_summary_of_an_empty_live_blog(): void {
		$this->assertSame(
			array(
				'count'  => 0,
				'latest' => 0,
				'newer'  => 0,
			),
			LiveUpdates::summarize( array(), 50 )
		);
	}

	public function test_timestamps_come_only_from_entries(): void {
		$entries   = $this->container()['innerBlocks'];
		$entries[] = array(
			'blockName' => 'core/paragraph',
			'attrs'     => array(),
		);
		$entries[] = array(
			'blockName' => 'mantek/live-update',
			'attrs'     => array(),
		);

		$this->assertSame( array( 300, 200, 100, 0 ), LiveUpdates::timestamps( $entries ) );
	}

	public function test_finds_a_live_blog_nested_inside_other_blocks(): void {
		$blocks = array(
			array(
				'blockName'   => 'core/paragraph',
				'innerBlocks' => array(),
			),
			array(
				'blockName'   => 'core/group',
				'innerBlocks' => array(
					array(
						'blockName'   => 'core/column',
						'innerBlocks' => array( $this->container() ),
					),
				),
			),
		);

		$this->assertSame( $this->container(), LiveUpdates::find_container( $blocks ) );
		$this->assertNull( LiveUpdates::find_container( array( $blocks[0] ) ) );
	}

	public function test_endpoint_hides_posts_the_public_cannot_read(): void {
		Functions\when( 'get_post' )->alias(
			static fn ( int $id ): ?WP_Post => match ( $id ) {
				1 => new WP_Post( array( 'ID' => 1 ) ),
				2 => new WP_Post( array( 'ID' => 2 ) ),
				3 => new WP_Post(
					array(
						'ID'            => 3,
						'post_password' => 'secret',
					)
				),
				default => null,
			}
		);
		Functions\when( 'is_post_publicly_viewable' )->alias( static fn ( WP_Post $post ): bool => 2 !== $post->ID );

		$this->assertTrue( LiveUpdates::rest_can_read( new WP_REST_Request( array( 'id' => 1 ) ) ) );

		foreach ( array( 2, 3, 99 ) as $id ) {
			$error = LiveUpdates::rest_can_read( new WP_REST_Request( array( 'id' => $id ) ) );
			$this->assertInstanceOf( WP_Error::class, $error );
			$this->assertSame( array( 'status' => 404 ), $error->get_error_data() );
		}
	}

	public function test_endpoint_reports_newer_entries_and_can_be_cached_publicly(): void {
		$container = $this->container();
		Functions\when( 'get_post' )->justReturn( new WP_Post( array( 'ID' => 5 ) ) );
		Functions\when( 'wp_cache_get' )->justReturn( false );
		Functions\expect( 'parse_blocks' )->once()->andReturn( array( $container ) );
		Functions\expect( 'wp_cache_set' )->once();

		$response = LiveUpdates::rest_summary(
			new WP_REST_Request(
				array(
					'id'    => 5,
					'after' => 200,
				)
			)
		);

		$this->assertSame(
			array(
				'count'  => 3,
				'latest' => 300,
				'newer'  => 1,
			),
			$response->get_data()
		);
		$this->assertSame( 'public, max-age=15', $response->headers['Cache-Control'] );
	}

	public function test_endpoint_skips_parsing_while_the_post_is_unchanged(): void {
		Functions\when( 'get_post' )->justReturn( new WP_Post( array( 'ID' => 5 ) ) );
		Functions\when( 'wp_cache_get' )->justReturn( array( 300, 200 ) );
		Functions\expect( 'parse_blocks' )->never();

		$response = LiveUpdates::rest_summary( new WP_REST_Request( array( 'id' => 5 ) ) );

		$this->assertSame( 2, $response->get_data()['count'] );
	}

	public function test_entry_shows_its_time_and_a_live_how_long_ago_label(): void {
		Functions\when( 'get_option' )->alias( static fn ( string $name ): string => 'time_format' === $name ? 'H:i' : 'j F Y' );
		Functions\when( 'wp_date' )->alias( static fn ( string $format, int $timestamp ): string => gmdate( $format, $timestamp ) );

		$timestamp = time() - 120;
		$html      = LiveUpdates::render_entry(
			array(
				'timestamp' => $timestamp,
				'important' => true,
			),
			'<p>Polls close.</p>'
		);

		$this->assertStringContainsString( sprintf( '<time class="wp-block-mantek-live-update__time" datetime="%s">', gmdate( 'c', $timestamp ) ), $html );
		$this->assertStringContainsString( 'data-wp-text="state.relativeTime"', $html );
		$this->assertStringContainsString( sprintf( 'id="update-%d"', $timestamp ), $html );
		$this->assertStringContainsString( 'class="is-important"', $html );
		$this->assertStringContainsString( '>Key update</span>', $html );
		$this->assertStringContainsString( sprintf( "data-wp-context='{\"timestamp\":%d}'", $timestamp ), $html );
		$this->assertStringContainsString( '<p>Polls close.</p>', $html );
	}

	public function test_time_includes_the_date_for_earlier_days(): void {
		Functions\when( 'get_option' )->alias( static fn ( string $name ): string => 'time_format' === $name ? 'H:i' : 'j F Y' );
		Functions\when( 'wp_date' )->alias( static fn ( string $format, int $timestamp ): string => gmdate( $format, $timestamp ) );

		$now = gmmktime( 18, 0, 0, 11, 4, 2026 );

		$this->assertSame( '09:15', LiveUpdates::format_time( gmmktime( 9, 15, 0, 11, 4, 2026 ), $now ) );
		$this->assertSame( '3 November 2026 23:50', LiveUpdates::format_time( gmmktime( 23, 50, 0, 11, 3, 2026 ), $now ) );
	}

	public function test_container_renders_the_badge_count_and_polling_context(): void {
		Functions\when( 'rest_url' )->alias( static fn ( string $path ): string => 'https://example.com/wp-json/' . $path );
		Functions\when( 'number_format_i18n' )->alias( static fn ( int $number ): string => (string) $number );
		Functions\expect( 'wp_interactivity_state' )->once();

		$block = new WP_Block( $this->container(), array( 'postId' => 5 ) );
		$html  = LiveUpdates::render(
			array(
				'isLive'       => true,
				'pollInterval' => 5,
			),
			'<article>…</article>',
			$block
		);

		$this->assertStringContainsString( 'data-wp-router-region="mantek/live-updates/5"', $html );
		$this->assertStringContainsString( '>Live</span>', $html );
		$this->assertStringContainsString( '>3 updates</span>', $html );
		$this->assertStringContainsString( '"endpoint":"https:\/\/example.com\/wp-json\/wp-newsroom-blocks\/v1\/live\/5"', $html );
		$this->assertStringContainsString( '"latest":300', $html );
		// The interval never drops below the cache lifetime of the endpoint.
		$this->assertStringContainsString( '"interval":15', $html );
		$this->assertStringContainsString( '<article>…</article>', $html );
	}

	public function test_container_after_coverage_ends_stops_polling(): void {
		Functions\when( 'rest_url' )->justReturn( 'https://example.com/wp-json/' );
		Functions\when( 'number_format_i18n' )->alias( static fn ( int $number ): string => (string) $number );
		Functions\when( 'wp_interactivity_state' )->justReturn( array() );

		$html = LiveUpdates::render( array( 'isLive' => false ), '', new WP_Block( $this->container(), array( 'postId' => 5 ) ) );

		$this->assertStringContainsString( '>Coverage ended</span>', $html );
		$this->assertStringContainsString( '"isLive":false', $html );
		$this->assertStringContainsString( 'class="is-ended"', $html );
	}
}

<?php
/**
 * Tests for the Breaking news bar's server rendering.
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks\Tests;

use Brain\Monkey\Functions;
use ManTek\NewsroomBlocks\BreakingNews;
use PHPUnit\Framework\Attributes\DataProvider;
use WP_Post;

final class BreakingNewsTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'get_permalink' )->alias( static fn ( WP_Post $post ): string => 'https://example.com/?p=' . $post->ID );
		Functions\when( 'get_the_title' )->alias( static fn ( WP_Post $post ): string => $post->post_title );
	}

	public function test_cut_off_is_rounded_down_to_the_minute(): void {
		$now  = gmmktime( 14, 30, 37, 11, 4, 2026 );
		$args = BreakingNews::query_args( array( 'maxAgeHours' => 2 ), $now );

		$this->assertSame( '2026-11-04 12:30:00', $args['date_query'][0]['after'] );
		$this->assertSame( 'post_date_gmt', $args['date_query'][0]['column'] );
		$this->assertFalse( $args['suppress_filters'] );
	}

	/**
	 * @return array<string, array{array<string, mixed>, int, string}>
	 */
	public static function clamped_attributes(): array {
		return array(
			'count below one'      => array( array( 'count' => 0 ), 1, '2026-11-03 14:30:00' ),
			'count above ten'      => array( array( 'count' => 50 ), 10, '2026-11-03 14:30:00' ),
			'hours below one'      => array( array( 'maxAgeHours' => 0 ), 5, '2026-11-04 13:30:00' ),
			'hours above one week' => array( array( 'maxAgeHours' => 999 ), 5, '2026-10-28 14:30:00' ),
		);
	}

	/**
	 * @param array<string, mixed> $attributes Block attributes.
	 * @param int                  $count      Expected posts_per_page.
	 * @param string               $after      Expected cut-off.
	 */
	#[DataProvider( 'clamped_attributes' )]
	public function test_count_and_age_stay_within_their_limits( array $attributes, int $count, string $after ): void {
		$args = BreakingNews::query_args( $attributes, gmmktime( 14, 30, 0, 11, 4, 2026 ) );

		$this->assertSame( $count, $args['posts_per_page'] );
		$this->assertSame( $after, $args['date_query'][0]['after'] );
	}

	public function test_filters_by_category_only_when_one_is_chosen(): void {
		$this->assertArrayNotHasKey( 'cat', BreakingNews::query_args( array(), 0 ) );
		$this->assertSame( 8, BreakingNews::query_args( array( 'categoryId' => 8 ), 0 )['cat'] );
	}

	public function test_speed_stays_readable(): void {
		$this->assertSame( 20, BreakingNews::speed( 5 ) );
		$this->assertSame( 200, BreakingNews::speed( 500 ) );
		$this->assertSame( 60, BreakingNews::speed( 'fast' ) );
		$this->assertSame( 90, BreakingNews::speed( '90' ) );
	}

	public function test_renders_nothing_when_there_is_no_recent_news(): void {
		Functions\expect( 'get_posts' )->once()->andReturn( array() );
		Functions\expect( 'wp_interactivity_state' )->never();

		$this->assertSame( '', BreakingNews::render( array() ) );
	}

	public function test_renders_two_tracks_with_the_copy_hidden_from_assistive_technology(): void {
		Functions\expect( 'get_posts' )->once()->andReturn(
			array(
				new WP_Post(
					array(
						'ID'         => 1,
						'post_title' => 'Ceasefire announced',
					) 
				),
				new WP_Post(
					array(
						'ID'         => 2,
						'post_title' => 'Markets open higher',
					) 
				),
			)
		);
		Functions\expect( 'wp_interactivity_state' )->once()->with( 'mantek/breaking-news', array( 'isReady' => false ) );

		$html = BreakingNews::render( array( 'speed' => 80 ) );

		$this->assertStringContainsString( 'style="--mantek-breaking-speed:80;"', $html );
		$this->assertStringContainsString( 'aria-label="Breaking"', $html );
		$this->assertStringContainsString( '>Breaking</strong>', $html );
		$this->assertSame( 2, substr_count( $html, '<ul class="wp-block-mantek-breaking-news__track' ) );
		$this->assertStringContainsString( '<ul class="wp-block-mantek-breaking-news__track" aria-hidden="true">', $html );
		$this->assertSame( 2, substr_count( $html, 'tabindex="-1"' ) );
		$this->assertStringContainsString( '"speed":80', $html );
	}
}

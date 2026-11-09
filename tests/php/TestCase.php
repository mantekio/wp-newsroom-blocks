<?php
/**
 * Base test case: sets up Brain Monkey and the WordPress functions every test can rely on.
 *
 * @package mantek-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase as PHPUnitTestCase;

abstract class TestCase extends PHPUnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();

		// Translation and escaping return their input, so assertions read the English source.
		Functions\stubTranslationFunctions();
		Functions\stubEscapeFunctions();
		Functions\when( 'wp_strip_all_tags' )->alias( 'strip_tags' );
		// Close enough to KSES for these tests: the allowed tags stay, every other tag goes, text stays.
		Functions\when( 'wp_kses' )->alias(
			// phpcs:ignore WordPressVIPMinimum.Functions.StripTags.StripTagsTwoParameters -- A stand-in for wp_kses(), which these tests cannot load.
			static fn ( string $html, array $allowed ): string => strip_tags( $html, array_keys( $allowed ) )
		);
		// No translation is loaded, as on an English site.
		Functions\when( 'is_textdomain_loaded' )->justReturn( false );
		Functions\when( 'determine_locale' )->justReturn( 'en_US' );
		Functions\when( 'get_block_wrapper_attributes' )->alias(
			static function ( array $extra = array() ): string {
				$attributes = '';
				foreach ( $extra as $name => $value ) {
					$attributes .= sprintf( ' %s="%s"', $name, $value );
				}
				return 'class="wp-block"' . $attributes;
			}
		);
		Functions\when( 'wp_interactivity_data_wp_context' )->alias(
			static fn ( array $context ): string => "data-wp-context='" . json_encode( $context ) . "'"
		);
	}

	protected function tearDown(): void {
		// Mockery's expectations (Functions\expect, Actions\expectAdded) are assertions too.
		$this->addToAssertionCount( \Mockery::getContainer()->mockery_getExpectationCount() );
		Monkey\tearDown();
		parent::tearDown();
	}
}

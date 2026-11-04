<?php
/**
 * Base test case: sets up Brain Monkey and the WordPress functions every test can rely on.
 *
 * @package wp-newsroom-blocks
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

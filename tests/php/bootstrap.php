<?php
/**
 * PHPUnit bootstrap: Composer's autoloader, the WordPress constants and classes the plugin
 * touches, and the plugin classes. WordPress functions are mocked per test with Brain Monkey.
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

$root = dirname( __DIR__, 2 );

require $root . '/vendor/autoload.php';

define( 'ABSPATH', '/tmp/wordpress/' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'ManTek\NewsroomBlocks\PLUGIN_FILE', $root . '/wp-newsroom-blocks.php' );

require __DIR__ . '/stubs.php';
require $root . '/includes/Plugin.php';
require $root . '/includes/ReadAlso.php';
require $root . '/includes/BreakingNews.php';
require $root . '/includes/LiveUpdates.php';

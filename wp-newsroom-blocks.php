<?php
/**
 * Plugin Name:       WP Newsroom Blocks
 * Plugin URI:        https://github.com/mantekio/wp-newsroom-blocks
 * Description:       Editorial blocks for newsrooms, built right-to-left first: Read also, Story timeline, Live updates and a Breaking news bar.
 * Version:           0.9.0
 * Requires at least: 6.8
 * Requires PHP:      8.1
 * Author:            ManTek Technologies
 * Author URI:        https://www.mantek.io
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-newsroom-blocks
 * Domain Path:       /languages
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

namespace ManTek\NewsroomBlocks;

defined( 'ABSPATH' ) || exit;

const VERSION     = '0.9.0';
const PLUGIN_FILE = __FILE__;

require_once __DIR__ . '/includes/Plugin.php';
require_once __DIR__ . '/includes/ReadAlso.php';
require_once __DIR__ . '/includes/BreakingNews.php';
require_once __DIR__ . '/includes/LiveUpdates.php';

Plugin::boot();

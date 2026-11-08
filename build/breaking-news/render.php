<?php
/**
 * Front-end markup for the Breaking news bar block.
 *
 * @package wp-newsroom-blocks
 *
 * @var array<string, mixed> $attributes Block attributes.
 */

defined( 'ABSPATH' ) || exit;

// Everything is escaped inside BreakingNews::render().
echo \ManTek\NewsroomBlocks\BreakingNews::render( $attributes ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

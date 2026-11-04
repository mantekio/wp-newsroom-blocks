<?php
/**
 * Front-end markup for one Live update entry.
 *
 * @package wp-newsroom-blocks
 *
 * @var array<string, mixed> $attributes Block attributes.
 * @var string               $content    The rendered inner blocks.
 */

// The inner blocks arrive rendered; everything else is escaped inside LiveUpdates::render_entry().
echo \ManTek\NewsroomBlocks\LiveUpdates::render_entry( $attributes, $content ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

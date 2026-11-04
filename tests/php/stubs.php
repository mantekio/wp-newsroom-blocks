<?php
/**
 * The smallest stand-ins for the WordPress classes the plugin uses, so unit tests need no WordPress install.
 *
 * phpcs:disable Generic.Files.OneObjectStructurePerFile, Squiz.Commenting
 *
 * @package wp-newsroom-blocks
 */

declare( strict_types = 1 );

// phpcs:disable WordPress.NamingConventions.ValidVariableName -- Mirrors core's property names.

class WP_Post {
	public int $ID                   = 0;
	public string $post_title        = '';
	public string $post_content      = '';
	public string $post_password     = '';
	public string $post_modified_gmt = '2026-11-04 10:00:00';

	public function __construct( array $fields = array() ) {
		foreach ( $fields as $key => $value ) {
			$this->$key = $value;
		}
	}
}

class WP_Block {
	public array $context      = array();
	public array $parsed_block = array();

	public function __construct( array $parsed_block = array(), array $context = array() ) {
		$this->parsed_block = $parsed_block;
		$this->context      = $context;
	}
}

class WP_Error {
	public function __construct( private string $code = '', private string $message = '', private mixed $data = null ) {}

	public function get_error_code(): string {
		return $this->code;
	}

	public function get_error_data(): mixed {
		return $this->data;
	}
}

class WP_REST_Server {
	public const READABLE = 'GET';
}

class WP_REST_Request implements ArrayAccess {
	public function __construct( private array $params = array() ) {}

	public function offsetExists( mixed $offset ): bool {
		return isset( $this->params[ $offset ] );
	}

	public function offsetGet( mixed $offset ): mixed {
		return $this->params[ $offset ] ?? null;
	}

	public function offsetSet( mixed $offset, mixed $value ): void {
		$this->params[ $offset ] = $value;
	}

	public function offsetUnset( mixed $offset ): void {
		unset( $this->params[ $offset ] );
	}
}

class WP_REST_Response {
	public array $headers = array();

	public function __construct( public mixed $data = null ) {}

	public function header( string $key, string $value ): void {
		$this->headers[ $key ] = $value;
	}

	public function get_data(): mixed {
		return $this->data;
	}
}

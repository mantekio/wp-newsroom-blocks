import { describe, expect, it } from 'vitest';

import {
	MAX_POSTS,
	addPost,
	movePost,
	removePost,
} from '../../src/read-also/utils';

describe( 'addPost', () => {
	it( 'appends a new article at the end', () => {
		expect( addPost( [ 4, 8 ], 15 ) ).toEqual( [ 4, 8, 15 ] );
	} );

	it( 'ignores an article that is already listed, and invalid IDs', () => {
		expect( addPost( [ 4 ], 4 ) ).toEqual( [ 4 ] );
		expect( addPost( [ 4 ], 0 ) ).toEqual( [ 4 ] );
		expect( addPost( [ 4 ], -3 ) ).toEqual( [ 4 ] );
	} );

	it( 'stops at the maximum', () => {
		const full = [ 1, 2, 3, 4, 5 ];
		expect( full ).toHaveLength( MAX_POSTS );
		expect( addPost( full, 6 ) ).toEqual( full );
	} );

	it( 'returns a new array and leaves its input alone', () => {
		const ids = [ 1, 2 ];
		const next = addPost( ids, 3 );
		expect( next ).not.toBe( ids );
		expect( ids ).toEqual( [ 1, 2 ] );
	} );
} );

describe( 'removePost', () => {
	it( 'removes the article and keeps the order of the rest', () => {
		expect( removePost( [ 1, 2, 3 ], 2 ) ).toEqual( [ 1, 3 ] );
	} );

	it( 'leaves the list unchanged for an unknown ID', () => {
		expect( removePost( [ 1, 2 ], 9 ) ).toEqual( [ 1, 2 ] );
	} );
} );

describe( 'movePost', () => {
	it( 'moves an article up and down', () => {
		expect( movePost( [ 1, 2, 3 ], 2, -1 ) ).toEqual( [ 1, 3, 2 ] );
		expect( movePost( [ 1, 2, 3 ], 0, 1 ) ).toEqual( [ 2, 1, 3 ] );
	} );

	it( 'ignores moves past either end', () => {
		expect( movePost( [ 1, 2, 3 ], 0, -1 ) ).toEqual( [ 1, 2, 3 ] );
		expect( movePost( [ 1, 2, 3 ], 2, 1 ) ).toEqual( [ 1, 2, 3 ] );
		expect( movePost( [ 1, 2, 3 ], 7, 1 ) ).toEqual( [ 1, 2, 3 ] );
	} );
} );

/**
 * Labels for the live blog, worked out exactly as the server works them out, so that a label
 * never changes when the page's scripts take over. Shared by the front end and the unit tests.
 */

/**
 * Numbers that cover every plural category CLDR defines. Must match LiveUpdates::PLURAL_SAMPLES in PHP.
 */
export const PLURAL_SAMPLES = [ 0, 1, 2, 3, 11, 100 ] as const;

/**
 * Translated labels keyed by sample number, each with %s where the number goes.
 */
export type PluralLabels = Readonly< Record< string, string > >;

/**
 * The "how long ago" labels the server sends: one for now, and every plural form of each unit.
 */
export type RelativeLabels = {
	now: string;
	minute: PluralLabels;
	hour: PluralLabels;
	day: PluralLabels;
};

export type Unit = 'now' | 'minute' | 'hour' | 'day';

/**
 * How long ago, as a unit and a whole number: under a minute is now, then minutes, hours and
 * days, each rounded to the nearest. Must match LiveUpdates::elapsed() in PHP.
 *
 * @param seconds Seconds since the update. A time in the future counts as now.
 */
export function elapsed( seconds: number ): [ Unit, number ] {
	if ( seconds < 60 ) {
		return [ 'now', 0 ];
	}
	const minutes = Math.round( seconds / 60 );
	if ( minutes < 60 ) {
		return [ 'minute', minutes ];
	}
	const hours = Math.round( seconds / 3600 );
	if ( hours < 24 ) {
		return [ 'hour', hours ];
	}
	return [ 'day', Math.round( seconds / 86400 ) ];
}

/**
 * A whole number as WordPress prints it: Western digits, grouped in threes with the site
 * language's thousands separator, the way number_format_i18n() does.
 *
 * @param value     The number.
 * @param separator The thousands separator the server sent.
 */
export function formatInteger( value: number, separator: string ): string {
	return String( Math.trunc( value ) ).replace(
		/\B(?=(\d{3})+(?!\d))/g,
		separator
	);
}

/**
 * Plural rules for a language, or English ones for a tag Intl does not accept.
 *
 * @param locale A BCP 47 language tag.
 */
function pluralRules( locale: string ): Intl.PluralRules {
	try {
		return new Intl.PluralRules( locale || 'en' );
	} catch {
		return new Intl.PluralRules( 'en' );
	}
}

/**
 * Picks the label in the plural form that suits a number, and writes the number into it.
 *
 * The server sends one label per sample number. The sample in the same plural category as the
 * real number gives every language, Arabic's six forms included, its correct form without a
 * JavaScript translation file.
 *
 * @param labels    Labels keyed by sample number, each containing %s.
 * @param count     The number.
 * @param locale    The language the labels were translated for.
 * @param separator The thousands separator the server sent.
 */
export function pluralLabel(
	labels: PluralLabels,
	count: number,
	locale: string,
	separator: string
): string {
	const rules = pluralRules( locale );
	const category = rules.select( count );
	const sample =
		PLURAL_SAMPLES.find( ( n ) => rules.select( n ) === category ) ?? 100;
	const template = labels[ String( sample ) ] ?? labels[ '100' ] ?? '%s';
	return template.replace( '%s', formatInteger( count, separator ) );
}

/**
 * "5 minutes ago" in the site's language, from the labels the server sent.
 *
 * @param seconds   Seconds since the update.
 * @param labels    The "how long ago" labels.
 * @param locale    The language the labels were translated for.
 * @param separator The thousands separator the server sent.
 */
export function relativeLabel(
	seconds: number,
	labels: RelativeLabels,
	locale: string,
	separator: string
): string {
	const [ unit, value ] = elapsed( seconds );
	return unit === 'now'
		? labels.now
		: pluralLabel( labels[ unit ], value, locale, separator );
}

# Changelog

All notable changes to **WP Newsroom Blocks** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0]

### Added
- Initial release: four editorial blocks for newsrooms, built right-to-left first, under a new **Newsroom** inserter category.
  - **Breaking news bar** (`mantek/breaking-news`): the newest headlines from a chosen category, only from the last few hours, hidden when there are none. Pause and close buttons, pause on hover and focus, still for reduced motion and when the headlines fit, scrolling in the reading direction.
  - **Read also** (`mantek/read-also`): up to five related articles, searched and ordered in the editor, rendered on the server, skipping unpublished articles and the current post.
  - **Story timeline** (`mantek/timeline`, `mantek/timeline-event`): dated events saved as plain HTML, with a date picker that fills in an editable label and machine-readable `<time>` dates.
  - **Live updates** (`mantek/live-updates`, `mantek/live-update`): a live blog with timestamped entries, newest first, key updates, "how long ago" labels that keep counting, and new entries offered without a page reload through the Interactivity API router, fetched past any page cache. Open pages stop checking once coverage ends.
- A public polling endpoint, `GET /wp-json/wp-newsroom-blocks/v1/live/<id>`, cached for 15 seconds so a CDN can absorb a large audience.
- WordPress 6.8 support: `<time>` is added to the post allow-list there (WordPress has it from 6.9), so authors without `unfiltered_html` can save dated timeline events, and the breaking news bar sets its scroll direction itself, because 6.8 serves the left-to-right stylesheet on right-to-left sites.
- Arabic translation, with all six Arabic plural forms.
- Tests: PHPUnit with Brain Monkey, Vitest, and Playwright end-to-end tests in English and Arabic on WordPress Playground. CI runs them on PHP 8.1 and 8.4, and on WordPress 6.8 and the latest version.

[0.9.0]: https://github.com/mantekio/wp-newsroom-blocks/releases/tag/v0.9.0

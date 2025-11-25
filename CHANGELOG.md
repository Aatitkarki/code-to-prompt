# Change Log

All notable changes to the "code-to-prompt" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0] - 2025-11-26

### Added

- Webpack bundling pipeline that produces a trimmed `dist/` build (with the wasm asset) for publishing
- Prepublish step now runs the bundle to keep Marketplace packaging consistent

### Changed

- Extension entry now points at `dist/extension.js` so activation aligns with the shipped bundle
- Documentation refresh with a clearer README and updated visuals

## [0.0.4] - 2024-03-19

### Added

- Token count display for each file
- Settings dropdown with separator configuration
- Improved file selection state persistence
- Better handling of scroll position state

### Changed

- Enhanced UI with token counts and better visual hierarchy
- Improved directory expansion state persistence
- Better error handling and logging

## [0.0.3] - 2024-03-19

### Fixed

- Updated repository URL in documentation to the correct project repository

## [0.0.2] - 2025-02-11

### Fixed

- Added extension icon configuration to display properly in VS Code marketplace

## [0.0.1]

### Added

- Initial release

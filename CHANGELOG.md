# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Add Go protobuf generation support ([#131](https://github.com/opensearch-project/opensearch-protobufs/pull/131))
- Add protobuf zip generation for releases ([#139](https://github.com/opensearch-project/opensearch-protobufs/pull/139))

### Changed
- Replaced deprecated `eslint-config-standard-with-typescript` with `eslint-config-love`
- Updated release artifact naming for better clarity and Jenkins compatibility

### Removed

### Fixed
- Fixed Jenkins `downloadReleaseAssetName` parameter to use exact filename instead of wildcards

### Security
- Updated gRPC from 1.68.2 to 1.70.0 to address security vulnerabilities in Netty dependencies
- Updated Guava from 33.2.1-jre to 33.3.1-jre
- Added explicit google-auth-library-oauth2-http 1.27.0 to address authentication library vulnerabilities
- Added explicit okio 3.9.1 to address I/O library vulnerabilities
- Replaced deprecated eslint-config-standard-with-typescript with eslint-config-love
- Updated json-schema-to-typescript from 14.0.4 to 15.0.4 to address CVE-2021-3918
- Updated @eslint/eslintrc and @stylistic/eslint-plugin to latest secure versions
- Added npm overrides for junit to ensure version ≥4.13.2

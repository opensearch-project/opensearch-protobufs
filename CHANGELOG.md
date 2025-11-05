# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Preprocessing: Change prefix from underscore_ to x_ and require map key ([#216](https://github.com/opensearch-project/opensearch-protobufs/pull/216))
- Add Cardinality and Missing aggregations. ([#245](https://github.com/opensearch-project/opensearch-protobufs/pull/245))
- Add terms aggregation protos  ([#268](https://github.com/opensearch-project/opensearch-protobufs/pull/268))
- Preprocessing: Handle unnamed additionalProperties.([#272](https://github.com/opensearch-project/opensearch-protobufs/pull/272))

### Changed
- Update preprocessing for x-protobuf-excluded ([#266](https://github.com/opensearch-project/opensearch-protobufs/pull/266))
- Fix aggregations protos ([#270](https://github.com/opensearch-project/opensearch-protobufs/pull/270))

### Changed
- Replaced deprecated `eslint-config-standard-with-typescript` with `eslint-config-love`
- Updated release artifact naming for better clarity and Jenkins compatibility

### Removed
- Remove error responses for single doc ingestion APIS (Index, Update, Get, Delete Doc) ([#258](https://github.com/opensearch-project/opensearch-protobufs/pull/258))

### Fixed
- Fixed Jenkins `downloadReleaseAssetName` parameter to use exact filename instead of wildcards

### Security
- Updated Guava from 33.2.1-jre to 33.3.1-jre
- Added explicit google-auth-library-oauth2-http 1.27.0 to address authentication library vulnerabilities
- Added explicit okio 3.9.1 to address I/O library vulnerabilities
- Replaced deprecated eslint-config-standard-with-typescript with eslint-config-love
- Updated json-schema-to-typescript from 14.0.4 to 15.0.4 to address CVE-2021-3918
- Updated @eslint/eslintrc and @stylistic/eslint-plugin to latest secure versions
- Added npm overrides for junit to ensure version ≥4.13.2

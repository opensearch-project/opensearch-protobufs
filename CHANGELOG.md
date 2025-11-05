# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Preprocessing: Change prefix from underscore_ to x_ and require map key ([#216](https://github.com/opensearch-project/opensearch-protobufs/pull/216))
- Add Cardinality and Missing aggregations. ([#245](https://github.com/opensearch-project/opensearch-protobufs/pull/245))
- Add terms aggregation protos  ([#268](https://github.com/opensearch-project/opensearch-protobufs/pull/268))
- Preprocessing: Handle unnamed additionalProperties.([#272](https://github.com/opensearch-project/opensearch-protobufs/pull/272))
- Support importing without proto file name knowledge in Python generated protobuf code ([#275](https://github.com/opensearch-project/opensearch-protobufs/pull/275))

### Changed
- Update preprocessing for x-protobuf-excluded ([#266](https://github.com/opensearch-project/opensearch-protobufs/pull/266))
- Fix aggregations protos ([#270](https://github.com/opensearch-project/opensearch-protobufs/pull/270))

### Removed
- Remove error responses for single doc ingestion APIS (Index, Update, Get, Delete Doc) ([#258](https://github.com/opensearch-project/opensearch-protobufs/pull/258))

### Fixed

### Security
- Updated gRPC from 1.68.2 to 1.70.0 to address multiple Netty vulnerabilities (CVE-2024-47535 and others)
- Updated Protobuf from 3.25.5 to 3.25.8 to address CVE-2024-7254 (stack overflow vulnerability)
- Updated JavaScript dependencies to address low-severity vulnerabilities:
  - eslint-config-standard-with-typescript: 43.0.1 -> 43.0.2
  - json-schema-to-typescript: 14.0.4 -> 15.0.2
  - @eslint/eslintrc: 3.0.2 -> 3.1.0
- Added JUnit override >=4.13.2 to address test framework vulnerabilities

# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added

### Changed
 - Fix simplifySingleMapSchema to generate named wrapper schemas. ([#406](https://github.com/opensearch-project/opensearch-protobufs/pull/406))
 - Change vendorExtension protobuf type handling to use protobuf type instead of openApi type ([#409](https://github.com/opensearch-project/opensearch-protobufs/pull/409))
 - Normalize mixed oneOf patterns ([#416](https://github.com/opensearch-project/opensearch-protobufs/pull/416))
 - Add normalizeAnyOfInAllOf transformation to prevent protobuf generator from flattening allOf+anyOf structures ([#425](https://github.com/opensearch-project/opensearch-protobufs/pull/425))
 - Updated deduplicateOneOfWithArrayType to preserve oneOf variants when they have different title attributes ([#436](https://github.com/opensearch-project/opensearch-protobufs/pull/436))
### Removed

### Fixed

### Security

# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Preprocessing specification for additionalProperties ([#70](https://github.com/opensearch-project/opensearch-protobufs/pull/70)))
- Preprocessing spec for changing const to boolean. ([#72](https://github.com/opensearch-project/opensearch-protobufs/pull/72))
- Add IndexDocument, UpdateDocument, GetDocument, DeleteDocument protos and move services to protos/services folder ([#73](https://github.com/opensearch-project/opensearch-protobufs/pull/73)))
- Preprocessing oneof by removing oneOf if only one item ([#77](https://github.com/opensearch-project/opensearch-protobufs/pull/77))
- Move some shared enums to top level ([#80](https://github.com/opensearch-project/opensearch-protobufs/pull/80))
- Add search API to generated proto ([#82](https://github.com/opensearch-project/opensearch-protobufs/pull/82))
### Removed

### Fixed
- Fix missing `optional` keywords in IndexDocument, UpdateDocument, GetDocument, DeleteDocument protos ([#75](https://github.com/opensearch-project/opensearch-protobufs/pull/75)))

### Security

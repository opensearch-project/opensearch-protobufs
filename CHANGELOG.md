# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Add .pyi type hints to the python wheel ([#253](https://github.com/opensearch-project/opensearch-protobufs/pull/253))
- Preprocessing: change prefix from underscore_ to x_ and require map key ([#216](https://github.com/opensearch-project/opensearch-protobufs/pull/216))

### Changed
- Revert bulk response back to without error response ([#256](https://github.com/opensearch-project/opensearch-protobufs/pull/256))
- Change `indices_boost` to single map and rename request_body to bulk_request_body ([#257](https://github.com/opensearch-project/opensearch-protobufs/pull/257))
### Removed
- Remove error responses for single doc ingestion APIS (Index, Update, Get, Delete Doc) ([#258](https://github.com/opensearch-project/opensearch-protobufs/pull/258))

### Fixed

### Security

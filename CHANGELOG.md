# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Proto Convertion tooling support null value ([#189](https://github.com/opensearch-project/opensearch-protobufs/pull/189))
- Add `geo_distance` and `geo_bounding_box` to QueryContainer. ([#188](https://github.com/opensearch-project/opensearch-protobufs/pull/188))
- proto Conversion Tooling support vendor extension `x-protobuf-excluded` ([#192](https://github.com/opensearch-project/opensearch-protobufs/pull/192))

### Changed
- Update `RangeQuery` and `NestedQuery` protobuf type ([#196](https://github.com/opensearch-project/opensearch-protobufs/pull/196))
- Modify `searchResponse` and `bulkResponse` according to the updated spec and remove the error response. ([#194](https://github.com/opensearch-project/opensearch-protobufs/pull/194))

### Removed

### Fixed
- Update python wheel versioning to read from version.properties ([#201](https://github.com/opensearch-project/opensearch-protobufs/pull/201))

### Security

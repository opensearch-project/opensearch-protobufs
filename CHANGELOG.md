# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Add compatibility matrix ([#373](https://github.com/opensearch-project/opensearch-protobufs/pull/373))
- Enhance spec-filter to support x-operation-group filtering and merge parameters across operations in same x-operation-group instead of selecting by max parameters ([#374](https://github.com/opensearch-project/opensearch-protobufs/pull/374))
- Add BoostingQuery and SimpleQueryString protos ([#376](https://github.com/opensearch-project/opensearch-protobufs/pull/376))
- Add protobuf generation documentation and remove unused BUILD dependency ([#379](https://github.com/opensearch-project/opensearch-protobufs/pull/379))
- Test Coverage Improvements ([#380](https://github.com/opensearch-project/opensearch-protobufs/pull/380))
- Add TermsAggregation, MaxAggregation, MinAggregation support in AggregationContainer and add MaxAggregate, MinAggregate, TermsAggregate variants (DoubleTermsAggregate, LongTermsAggregate, StringTermsAggregate, UnmappedTermsAggregate, UnsignedLongTermsAggregate) in Aggregate ([#391](https://github.com/opensearch-project/opensearch-protobufs/pull/391))

### Changed
 - Fix simplifySingleMapSchema to generate named wrapper schemas. ([#406](https://github.com/opensearch-project/opensearch-protobufs/pull/406))
 - Change vendorExtension protobuf type handling to use protobuf type instead of openApi type ([#409](https://github.com/opensearch-project/opensearch-protobufs/pull/409))
 - Normalize mixed oneOf patterns ([#416](https://github.com/opensearch-project/opensearch-protobufs/pull/416))
### Removed

### Fixed

### Security

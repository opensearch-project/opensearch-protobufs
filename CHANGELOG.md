# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Preprocessing - Support x-protobuf-name overrides existing property and parameter name ([#306](https://github.com/opensearch-project/opensearch-protobufs/pull/306))
- Preprocessing - Handling spec added/deprecated versioning.([#309](https://github.com/opensearch-project/opensearch-protobufs/pull/309))
- preprocessing - Support maxProperties=1 constraints by marking them as `oneof` for protobuf generation ([#317](https://github.com/opensearch-project/opensearch-protobufs/pull/317))
- Preprocessing - Support x-protobuf-required to enforce required protobuf field and convert oneOf properties pattern to min/max Properties = 1 ([#318](https://github.com/opensearch-project/opensearch-protobufs/pull/318))
- Preprocessing - Add schema exclusion list to filter out schemas and their dependencies ([#328](https://github.com/opensearch-project/opensearch-protobufs/pull/328))
- Postprocessing- Add postprocessing support ([#333](https://github.com/opensearch-project/opensearch-protobufs/pull/333))
- Preprocessing - Collapses single-item composite schemas (oneOf, allOf, anyOf) by replacing the composite with its single child schema. ([#334](https://github.com/opensearch-project/opensearch-protobufs/pull/334))
- Expand GeneralNumber to support unsigned integer types ([#339](https://github.com/opensearch-project/opensearch-protobufs/pull/339))

### Changed
- Backward incompatible change for unimplemented query types `ScriptScoreQuery`, `SimpleQueryStringQuery`, `DisMaxQuery`, `IntervalsQuery`, `QueryStringQuery` and `TermsAggregation` ([#324](https://github.com/opensearch-project/opensearch-protobufs/pull/324))
- Backward compatible change for implemented query types `RegexpQuery`, `WildcardQuery`, `PrefixQuery`, `MultiMatchQuery`, `MatchQuery`, `MatchBoolPrefixQuery`, `FuzzyQuery` and `ErrorCause` ([#325](https://github.com/opensearch-project/opensearch-protobufs/pull/325))
- Remove unsupported protobufs `Aggregate`, `Suggester` and `AggregationContainer` ([#327](https://github.com/opensearch-project/opensearch-protobufs/pull/327))
- Consolidate all protobuf schemas into common.proto ([#330](https://github.com/opensearch-project/opensearch-protobufs/pull/330))
- Reorder protobufs - messages top, enums bottom ([#331](https://github.com/opensearch-project/opensearch-protobufs/pull/331))
- Reformat protobufs - Add lines between fields and messages ([#332](https://github.com/opensearch-project/opensearch-protobufs/pull/332))

### Removed
- Removed unused messages ([#319](https://github.com/opensearch-project/opensearch-protobufs/pull/319))

### Fixed
- Include LICENSE.txt in Python wheel distribution ([#321](https://github.com/opensearch-project/opensearch-protobufs/pull/321))

### Security
- Fixed minimist, resolve and js-yaml version to address security vulnerabilities ([#316](https://github.com/opensearch-project/opensearch-protobufs/pull/316))
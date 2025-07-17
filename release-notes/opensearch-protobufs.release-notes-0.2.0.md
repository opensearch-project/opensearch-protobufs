## Version 0.2.0 (2025-04-07) Release Notes

### Added
- Bump version.properties and update changelog after 0.1.0 release  ([#51](https://github.com/opensearch-project/opensearch-protobufs/pull/51))
- Add missing derived, verbose_pipeline, and other fields to SearchRequestBody protos and fix optional fields ([#55](https://github.com/opensearch-project/opensearch-protobufs/pull/55)
- Address vulnerability issues([#56](https://github.com/opensearch-project/opensearch-protobufs/pull/56/))
- Record source file commit id and change Struct to ObjectMap type for generated protos. ([#61](https://github.com/opensearch-project/opensearch-protobufs/pull/61))
- Address okio vulnerability issue ([#57](https://github.com/opensearch-project/opensearch-protobufs/pull/57/))
- Add auto remove workflow for auto-pr-branch ([#62](https://github.com/opensearch-project/opensearch-protobufs/pull/62))
- Reformat generated protobuf schema ([#64](https://github.com/opensearch-project/opensearch-protobufs/pull/64))
- Add generated proto formatter and modify proto template ([#66](https://github.com/opensearch-project/opensearch-protobufs/pull/66))

### Removed

### Fixed
- Fix derived type ([#57](https://github.com/opensearch-project/opensearch-protobufs/pull/57))
- Fix slice id type ([#58](https://github.com/opensearch-project/opensearch-protobufs/pull/58))
- Fix QueryContainer protos for matchall, match none, and term query ([#60](https://github.com/opensearch-project/opensearch-protobufs/pull/60))

### Security

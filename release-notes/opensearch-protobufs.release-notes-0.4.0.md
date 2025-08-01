## Version 0.4.0 (2025-07-13) Release Notes

### Added
- Add search API to generated proto ([#82](https://github.com/opensearch-project/opensearch-protobufs/pull/82))
- Replace required property name from _* to underscore_* and remove duplicate __ from modified title ([#88](https://github.com/opensearch-project/opensearch-protobufs/pull/88))
- Preprocessing spec for collapse oneOf if childComplexOneOf property contains child SimpleOneOf. ([#89](https://github.com/opensearch-project/opensearch-protobufs/pull/89))
- Preprocessing spec for reconstructing a standard schema from single-key map. ([#90](https://github.com/opensearch-project/opensearch-protobufs/pull/90))
- Using official protobuf generator. ([#91](https://github.com/opensearch-project/opensearch-protobufs/pull/91))
- Preprocessing spec for deduplicating enum values. ([#93](https://github.com/opensearch-project/opensearch-protobufs/pull/93))
- Address Generator Build Failure. ([#95](https://github.com/opensearch-project/opensearch-protobufs/pull/95))
- Add http code at the end of response. ([#97](https://github.com/opensearch-project/opensearch-protobufs/pull/97))
- Add GRPC Search server-side streaming endpoint ([#98](https://github.com/opensearch-project/opensearch-protobufs/pull/98))
- Add bi-directional streaming Bulk GRPC endpoint ([#101](https://github.com/opensearch-project/opensearch-protobufs/pull/101))
- Update KNN protos ([#103](https://github.com/opensearch-project/opensearch-protobufs/pull/103))
- Update BoolQuery protos ([#105](https://github.com/opensearch-project/opensearch-protobufs/pull/105)
- Update the maven snapshot publish endpoint and credential ([#107](https://github.com/opensearch-project/opensearch-protobufs/pull/107))  
- Add oneof to QueryContainer and convert single-element maps to dedicated messages ([#106](https://github.com/opensearch-project/opensearch-protobufs/pull/106)
- Update maven publishing workflow to accommodate nexus EOL ([#112](https://github.com/opensearch-project/opensearch-protobufs/pull/112)

### Removed

### Fixed

### Security

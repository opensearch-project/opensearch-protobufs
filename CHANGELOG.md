# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

### Added
- Add bulk + search protos and bazel to compile ([#5](https://github.com/opensearch-project/opensearch-protobufs/pull/5))
- Add scripts to create java opensearch-protobuf-1.0.0.jar ([#6](https://github.com/opensearch-project/opensearch-protobufs/pull/6))
- Add GHA to build and publish snapshots to maven & add mvn process ([#11](https://github.com/opensearch-project/opensearch-protobufs/pull/11))
- Use java_grpc_library instead of protoc to generate GRPC Java libraries. ([#15](https://github.com/opensearch-project/opensearch-protobufs/pull/15))
- Exclude `com.google.protobuf.*` classes from the `opensearch-protobuf-*` jar and upgrade dependency versions to match core ([#17](https://github.com/opensearch-project/opensearch-protobufs/pull/17))
- Update jar publishing to sonatype repository with gradle ([#14](https://github.com/opensearch-project/opensearch-protobufs/pull/14))
- Update jar generation script with proper exit trap and add java build github action workflow

### Removed

### Fixed
- Alphabetize maintainers ([#6](https://github.com/opensearch-project/opensearch-protobufs/pull/7))
- Rename opensearch-protobuf to opensearch-protobufs ([#13](https://github.com/opensearch-project/opensearch-protobufs/pull/13))
- Fix sourcefiles not found ([#18](https://github.com/opensearch-project/opensearch-protobufs/pull/18))

### Security

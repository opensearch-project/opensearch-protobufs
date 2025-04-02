# CHANGELOG

Inspired from [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]
### Added
- Bump version.properties and update changelog after 0.1.0 release  ([#51](https://github.com/opensearch-project/opensearch-protobufs/pull/51))
### Removed

### Fixed

### Security

## [0.1.0] - 2025-04-02

### Added
- Add bulk + search protos and bazel to compile ([#5](https://github.com/opensearch-project/opensearch-protobufs/pull/5))
- Add scripts to create java opensearch-protobuf-1.0.0.jar ([#6](https://github.com/opensearch-project/opensearch-protobufs/pull/6))
- Add GHA to build and publish snapshots to maven & add mvn process ([#11](https://github.com/opensearch-project/opensearch-protobufs/pull/11))
- Use java_grpc_library instead of protoc to generate GRPC Java libraries. ([#15](https://github.com/opensearch-project/opensearch-protobufs/pull/15))
- Exclude `com.google.protobuf.*` classes from the `opensearch-protobuf-*` jar and upgrade dependency versions to match core ([#17](https://github.com/opensearch-project/opensearch-protobufs/pull/17))
- Update jar publishing to sonatype repository with gradle ([#14](https://github.com/opensearch-project/opensearch-protobufs/pull/14))
- Update jar generation script with proper exit trap and add java build github action workflow ([#24](https://github.com/opensearch-project/opensearch-protobufs/pull/24))
- Add proto convert preprocessing scripts. ([#7](https://github.com/opensearch-project/opensearch-protobufs/pull/7)
- Remove maven pom dependencies ([#26](https://github.com/opensearch-project/opensearch-protobufs/pull/26))
- Resolve CVE-2023-36665 protobufjs ([#32](https://github.com/opensearch-project/opensearch-protobufs/pull/32))
- Wrap ScriptLanguage fields into a oneof and mark as required ([#35](https://github.com/opensearch-project/opensearch-protobufs/pull/35))
- Prepare scripts/tasks for maven central publication ([#37](https://github.com/opensearch-project/opensearch-protobufs/pull/37))
- Simplify 'ObjectMap' proto definition and fix type for 'ErrorCause.metadata' ([#36](https://github.com/opensearch-project/opensearch-protobufs/pull/36))
- Add GHA to convert from spec to proto ([#39](https://github.com/opensearch-project/opensearch-protobufs/pull/39))
- Ignore OpenApi-generator generated unnecessary files and add signoff/label:skip-changelog to generated PR ([#40](https://github.com/opensearch-project/opensearch-protobufs/pull/40))
- Add release drafter action and jenkins workflow in preparation for 0.1.0 maven release ([#43](https://github.com/opensearch-project/opensearch-protobufs/pull/43))
- Document steps to cut a release ([#44](https://github.com/opensearch-project/opensearch-protobufs/pull/44))
- Add missing SearchRequestBody and ErrorResponse fields ([#45](https://github.com/opensearch-project/opensearch-protobufs/pull/45))
- Generate javadoc jar and sources jar ([#49](https://github.com/opensearch-project/opensearch-protobufs/pull/49))
- Upload javadoc and sources jar to maven ([#50](https://github.com/opensearch-project/opensearch-protobufs/pull/50))

### Removed

### Fixed
- Alphabetize maintainers ([#6](https://github.com/opensearch-project/opensearch-protobufs/pull/7))
- Rename opensearch-protobuf to opensearch-protobufs ([#13](https://github.com/opensearch-project/opensearch-protobufs/pull/13))
- Fix sourcefiles not found ([#18](https://github.com/opensearch-project/opensearch-protobufs/pull/18))
- Fix ErrorCause and InlineGetDictUserDefined protos ([#29](https://github.com/opensearch-project/opensearch-protobufs/pull/29))
- Add missing 'header' field to ErrorCause and fix type of 'metadata' field ([#33](https://github.com/opensearch-project/opensearch-protobufs/pull/33))
- Fix 'Value' fields ([#38](https://github.com/opensearch-project/opensearch-protobufs/pull/38))
- Add missing jar build step before release publish ([#47](https://github.com/opensearch-project/opensearch-protobufs/pull/47))

### Security
- Resolve CVE-2023-36665 protobufjs ([#32](https://github.com/opensearch-project/opensearch-protobufs/pull/32))

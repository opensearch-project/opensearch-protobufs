# Steps to cut a release

**DO NOT cut a tag by going to release section of Github UI. It will mess up the Github Action.**

Note: A maintainer must remember to perform steps 1 and 6.
1. Identify the commit to release and create a tag on it from the upstream opensearch-protobufs repository, not a forked one:
```
git fetch origin
git tag <tag-name> <commit-sha>
git push origin <tag-name>
```
2. Wait for Github Actions to run. The workflow requires approval from reviewers configured in the `release-approval` GitHub environment before it proceeds.
3. Once approved, a pre-release will be created with the build artifacts attached. Python artifacts are published to PyPI directly by the workflow.
4. This pre-release triggers the [jenkins release workflow](https://build.ci.opensearch.org/job/opensearch-protobufs-release) as a result of which the Java artifacts are released on [maven central](https://central.sonatype.com/). Please note that the release workflow is triggered only if created release is in pre-release state.
5. Once the above release workflow is successful, it creates a GitHub issue requesting maintainers to manually publish the pre-release to release on GitHub.
6. Bump [version.properties](./version.properties), update [release-notes](./release-notes/), and clean up entries from [CHANGELOG.md](./CHANGELOG.md) via a PR.

## Maintaining Compatibility Matrix

When a new OpenSearch version is released, update the [COMPATIBILITY.md](./COMPATIBILITY.md) by adding a new column for that version and marking compatibility with existing protobuf versions.

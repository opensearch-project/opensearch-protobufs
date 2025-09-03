# Steps to cut a release

**DO NOT cut a tag by going to release section of Github UI. It will mess up the Github Action.**

Note: A maintainer must remember to perform steps 1, 2 and 4.
1. Run these commands from the upstream opensearch-protobufs repository, not a forked one.
Check that upstream is set to:
```
~/opensearch-protobufs on [main] % git remote -v
upstream        git@github.com:opensearch-project/opensearch-protobufs.git (fetch)
upstream        git@github.com:opensearch-project/opensearch-protobufs.git (push)
```
Then run:
```
git checkout main
git fetch upstream
git rebase upstream/main
git tag <version>
git push upstream <version>
```
2. Wait for Github Actions to run and open the newly created issue. Two maintainers should comment `approve` in the issue.
3. Wait for Jenkins to be triggered, pull the artifacts built by Actions, push to sonatype release channel on remote. Wait for an hour or so for Sonatype to copy it into Maven Central.
4. Bump [version.properties](./version.properties) as well as the py_wheel `version` property in the top level [BUILD.bazel](./BUILD.bazel), update [release-notes](./release-notes/), and clean up entries from [CHANGELOG.md](./CHANGELOG.md) via a PR.

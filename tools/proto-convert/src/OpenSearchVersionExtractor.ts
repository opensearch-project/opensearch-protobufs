import _ from 'lodash';
import * as semver from 'semver';
import Logger from './utils/logger';
import { deleteMatchingKeys, remove_unused } from './utils/helper';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * Processes version-related vendor extensions:
 * - x-version-added: Removes fields added after current version
 * - x-version-deprecated: Removes fields deprecated in current version or earlier
 * - x-version-removed: Removes fields removed before current version
 */
export class OpenSearchVersionExtractor {
  private _logger: Logger;
  private _spec: OpenAPIV3.Document;
  private _target_version: string;

  constructor(spec: OpenAPIV3.Document, logger: Logger) {
    this._spec = spec;
    this._logger = logger;
    this._target_version = '';
  }


  process(currentVersion: string): OpenAPIV3.Document {
    const coerced = semver.coerce(currentVersion);
    this._target_version = coerced?.toString() || currentVersion;
    this._logger.info(`Processing version constraints for OpenSearch ${this._target_version} ...`);

    deleteMatchingKeys(this._spec, this.#exclude_per_semver.bind(this));
    remove_unused(this._spec);

    this._logger.info('Version processing complete');
    return this._spec;
  }

  #exclude_per_semver(obj: any): boolean {
    if (this._target_version == undefined) return false

    const x_version_added = semver.coerce(obj['x-version-added'] as string)
    const x_version_deprecated = semver.coerce(obj['x-version-deprecated'] as string)
    const x_version_removed = semver.coerce(obj['x-version-removed'] as string)

    if (x_version_added !== null) {
      if (semver.gt(x_version_added, this._target_version)) {
          return true
      }
    }


    if (x_version_deprecated !== null) {
      if (semver.lte(x_version_deprecated, this._target_version)) {
          return true
      }
    }

    // TODO: Uncomment this when figure out https://github.com/opensearch-project/opensearch-api-specification/blob/61777cdbe5bc32204640e6e236daf7cf71aa871d/spec/schemas/_common.yaml#L12
    // if (x_version_removed !== null) {
    //   if (semver.lte(x_version_removed, this._target_version)) {
    //       return true
    //   }
    // }

    return false
  }
}

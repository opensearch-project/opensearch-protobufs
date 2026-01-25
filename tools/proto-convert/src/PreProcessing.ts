import { Command, Option } from '@commander-js/extra-typings';
import { read_yaml, write_yaml, parsePathsConfig } from './utils/helper';

// Path config type: path -> { x-operation-group: string[] }
type PathConfig = Record<string, { 'x-operation-group'?: string[] } | null>;
import Filter from './Filter';
import { Sanitizer } from './Sanitizer';
import logger from './utils/logger';
import * as path from 'path';
import {SchemaModifier} from "./SchemaModifier";
import {VendorExtensionProcessor} from "./VendorExtensionProcessor";
import {GlobalParameterConsolidator} from "./GlobalParamWrapper";
import {OpenSearchVersionExtractor} from "./OpenSearchVersionExtractor";

// Load config from spec-filter.yaml
const config = read_yaml<{ paths?: PathConfig; excluded_schemas?: string[] }>(
  path.join(__dirname, 'config', 'spec-filter.yaml')
);

const target_paths_map = parsePathsConfig(config.paths);
const excluded_schemas = new Set(config.excluded_schemas ?? []);

const command = new Command()
  .description('Preprocess an OpenAPI spec by filtering for specific paths and then sanitizing it.')
  .addOption(new Option('-i, --input <path>', 'input YAML file').default((path.resolve(__dirname, '../../../opensearch-openapi.yaml'))))
  .addOption(new Option('-o, --output <path>', 'output YAML file').default((path.resolve(__dirname, '../../../build/processed-opensearch-openapi.yaml'))))
  .addOption(new Option('--verbose', 'show merge details').default(false))
  .addOption(new Option('--opensearch-version <version>', 'current OpenSearch version for deprecation removal').default('3.4'))
  .allowExcessArguments(false)
  .parse();


type PreprocessingOpts = {
  input: string;
  output: string;
  verbose: boolean;
  opensearchVersion: string;
};

const opts = command.opts() as PreprocessingOpts;

try {
  const pathsList = Array.from(target_paths_map.keys());
  logger.info(`PreProcessing ${pathsList.join(', ')} into ${opts.output} ...`)
  const original_spec = read_yaml(opts.input)
  const filtered_spec = new Filter(original_spec, target_paths_map, excluded_schemas).filter();
  const version_processed_spec = new OpenSearchVersionExtractor(filtered_spec).process(opts.opensearchVersion);
  const sanitized_spec = new Sanitizer(version_processed_spec).sanitize();
  const consolidated_spec = new GlobalParameterConsolidator(sanitized_spec).consolidate();
  const vendor_processed_spec = new VendorExtensionProcessor(consolidated_spec).process();
  const schema_modified_spec = new SchemaModifier(vendor_processed_spec).modify();
  write_yaml(opts.output, schema_modified_spec);

} catch (err) {
  logger.error(`Error in preprocessing: ${err}`);
  process.exit(1);
}
logger.info('Done.')

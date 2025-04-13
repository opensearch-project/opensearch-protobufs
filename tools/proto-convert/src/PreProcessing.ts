import { Command, Option } from '@commander-js/extra-typings';
import { read_yaml, write_yaml } from './utils/helper';
import Filter from './Filter';
import { Sanitizer } from './Sanitizer';
import Logger from './utils/logger';
import * as path from 'path';
import {SchemaModifier} from "./SchemaModifier";
import type {OpenAPIV3} from "openapi-types";

let config_filtered_path: string[] | undefined;
try {
  const config = read_yaml(path.join(__dirname, 'config','target_api.yaml'));
  config_filtered_path = config.paths;
} catch (e) {
  console.error(e);
  config_filtered_path = undefined;
}
const default_api_to_proto = config_filtered_path ?? ['/_search'];
const default_api_to_proto_str = default_api_to_proto.join(',');

const command = new Command()
  .description('Preprocess an OpenAPI spec by filtering for specific paths and then sanitizing it.')
  .addOption(new Option('-i, --input <path>', 'input YAML file').default((path.resolve(__dirname, '../../../opensearch-openapi.yaml'))))
  .addOption(new Option('-o, --output <path>', 'output YAML file').default((path.resolve(__dirname, '../../../build/processed-opensearch-openapi.yaml'))))
  .addOption(
    new Option('-p, --filtered_path <paths>', 'the paths to keep (comma-separated, e.g., /_search,)')
      .argParser((val: string) => val.split(',').map(s => s.trim()))
      .default(default_api_to_proto)
  )
  .addOption(new Option('--verbose', 'show merge details').default(false))
  .allowExcessArguments(false)
  .parse();


type PreprocessingOpts = {
  input: string;
  output: string;
  filtered_path: string[];
  verbose: boolean;
};

const opts = command.opts() as PreprocessingOpts;

const logger = new Logger();

try {
  logger.info(`PreProcessing ${opts.filtered_path.join(', ')} into ${opts.output} ...`)
  const original_spec = read_yaml(opts.input)
  const filtered_spec = new Filter().filter_spec(original_spec, opts.filtered_path);
  const sanitized_spec = new Sanitizer().sanitize(filtered_spec);
  const schema_modified_spec = new SchemaModifier(sanitized_spec).modify();
  write_yaml(opts.output, schema_modified_spec);

} catch (err) {
  logger.error(`Error in preprocessing: ${err}`);
  process.exit(1);
}
logger.info('Done.')
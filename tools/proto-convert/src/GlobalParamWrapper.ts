import { OpenAPIV3 } from 'openapi-types';

export class GlobalParameterConsolidator {
    private root: OpenAPIV3.Document;
    private readonly GLOBAL_PARAM_PREFIX = '_global___query';

    constructor(root: OpenAPIV3.Document) {
        this.root = root;
    }

    /**
     * Consolidates global query parameters into a single globalParams object.
     *
     */
    consolidate(): OpenAPIV3.Document {
        this.createGlobalParamsSchema();
        this.createGlobalParamsParameter();
        this.replaceGlobalParamsInPaths();
        return this.root;
    }

    private createGlobalParamsSchema(): void {
        const parameters = this.root.components?.parameters;
        if (!parameters) {
            return;
        }

        if (!this.root.components) {
            this.root.components = {};
        }
        if (!this.root.components.schemas) {
            this.root.components.schemas = {};
        }

        const properties: Record<string, any> = {};
        const addedParams = new Set<string>();

        for (const [paramKey, paramDef] of Object.entries(parameters)) {
            if (!paramDef) continue;

            // Check if parameter key starts with _global___query
            if (paramKey.startsWith(this.GLOBAL_PARAM_PREFIX)) {
                const param = paramDef as any;
                const paramName = param.name || paramKey;

                if (!addedParams.has(paramName)) {
                    const propertyObj: any = {
                        ...param
                    };
                    delete propertyObj.schema;
                    if (param.schema) {
                        Object.assign(propertyObj, param.schema);
                    }

                    properties[paramName] = propertyObj;
                    addedParams.add(paramName);
                }
            }
        }

        const globalParamsSchema: OpenAPIV3.SchemaObject = {
            type: 'object',
            description: 'Global query parameters that apply to all operations',
            properties,
        };

        (this.root.components.schemas as any).GlobalParams = globalParamsSchema;
    }

    private createGlobalParamsParameter(): void {
        if (!this.root.components) {
            this.root.components = {};
        }
        if (!this.root.components.parameters) {
            this.root.components.parameters = {};
        }

        const globalParamsParam: any = {
            name: 'globalParams',
            in: 'query',
            description: 'Global query parameters',
            schema: {
                $ref: '#/components/schemas/GlobalParams',
            }
        };

        (this.root.components.parameters as any).globalParams = globalParamsParam;
    }

    private replaceGlobalParamsInPaths(): void {
        if (!this.root.paths) {
            return;
        }

        for (const pathKey in this.root.paths) {
            const pathItem = this.root.paths[pathKey];
            if (!pathItem) continue;

            const methods = ['get', 'post', 'put', 'delete'];
            for (const method of methods) {
                const operation = (pathItem as any)[method] as OpenAPIV3.OperationObject | undefined;
                if (!operation) continue;

                this.replaceGlobalParamsInOperation(operation);
            }
        }
    }

    private replaceGlobalParamsInOperation(operation: OpenAPIV3.OperationObject): void {
        if (!operation.parameters) {
            return;
        }

        let hasGlobalParams = false;

        for (let i = operation.parameters.length - 1; i >= 0; i--) {
            const param = operation.parameters[i];
            const paramRef = (param as any).$ref;

            if (paramRef && paramRef.includes(`/${this.GLOBAL_PARAM_PREFIX}`)) {
                operation.parameters.splice(i, 1);
                hasGlobalParams = true;
            }
        }

        if (hasGlobalParams) {
            operation.parameters.push({
                $ref: '#/components/parameters/globalParams',
            } as OpenAPIV3.ReferenceObject);
        }
    }
}

import fastJsonStringify from 'fast-json-stringify';
import {
	FastifyPluginAsync,
	FastifySchemaCompiler,
	FastifySerializerCompiler
} from 'fastify';
import fp from 'fastify-plugin';
import * as v from 'valibot';

import valibotToJsonSchema from './valibotToJsonSchema.js';

export class ValibotValidationError extends Error {
	public readonly issues: v.BaseIssue<unknown>[];

	constructor(issues: v.BaseIssue<unknown>[], httpPart: string | undefined) {
		super(`Validation failed on ${httpPart ?? 'request'}`);
		this.issues = issues;
		Error.captureStackTrace(this, ValibotValidationError);
	}
}

declare module 'fastify' {
	interface FastifyTypeProviderDefault {
		validator: this['schema'] extends v.GenericSchema
			? v.InferOutput<this['schema']>
			: unknown;
		serializer: this['schema'] extends v.GenericSchema
			? v.InferInput<this['schema']>
			: unknown;
	}
}

const validatorCompiler: FastifySchemaCompiler<v.GenericSchema> =
	({ schema, httpPart }) =>
	data => {
		const result = v.safeParse(schema, data);

		if (!result.success) {
			return {
				error: new ValibotValidationError(result.issues, httpPart)
			};
		}

		return { value: result.output };
	};

const serializerCompiler: FastifySerializerCompiler<v.GenericSchema> = ({
	schema
}) => {
	const jsonSchema = valibotToJsonSchema(schema, 'input');
	return fastJsonStringify(jsonSchema as never);
};

const ValibotValidationPlugin: FastifyPluginAsync = async fastify => {
	fastify.setValidatorCompiler(validatorCompiler);
	fastify.setSerializerCompiler(serializerCompiler);
};

export default fp(ValibotValidationPlugin);

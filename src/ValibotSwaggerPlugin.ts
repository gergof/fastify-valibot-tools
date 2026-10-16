import FastifySwagger from '@fastify/swagger';
import { FastifyPluginAsync, RouteOptions } from 'fastify';
import fp from 'fastify-plugin';
import * as v from 'valibot';

import valibotToJsonSchema from './valibotToJsonSchema.js';

interface ValibotSwaggerPluginOptions {
	info: {
		title: string;
		version: string;
	};
	addCommonResponses?: (
		route: RouteOptions
	) => Record<number, v.GenericSchema>;
}

const convertSchema = (
	schema: unknown,
	typeMode: 'input' | 'output'
): unknown => {
	if (
		typeof schema === 'object' &&
		schema !== null &&
		'content' in schema &&
		typeof schema.content === 'object' &&
		schema.content !== null
	) {
		return {
			...schema,
			content: Object.fromEntries(
				Object.entries(schema.content).map(
					([contentType, definition]) => {
						if (
							typeof definition === 'object' &&
							definition !== null &&
							'schema' in definition
						) {
							return [
								contentType,
								{
									...definition,
									schema: valibotToJsonSchema(
										definition.schema as v.GenericSchema,
										typeMode
									)
								}
							];
						}

						return [contentType, definition];
					}
				)
			)
		};
	}

	return valibotToJsonSchema(schema as v.GenericSchema, typeMode);
};

const ValibotSwaggerPlugin: FastifyPluginAsync<
	ValibotSwaggerPluginOptions
> = async (fastify, options) => {
	await fastify.register(FastifySwagger, {
		openapi: {
			openapi: '3.0.3',
			info: options.info
		},
		transform: ({ route, schema, url }) => {
			if (!schema) {
				return { schema, url };
			}

			const { body, querystring, params, headers, response, ...rest } =
				schema;

			const jsonSchema: Record<string, unknown> = { ...rest };

			if (body) {
				jsonSchema.body = convertSchema(body, 'input');
			}

			if (querystring) {
				jsonSchema.querystring = convertSchema(querystring, 'input');
			}

			if (params) {
				jsonSchema.params = convertSchema(params, 'input');
			}

			if (headers) {
				jsonSchema.headers = convertSchema(headers, 'input');
			}

			let responses: Record<string, unknown> = {};

			if (response) {
				responses = Object.fromEntries(
					Object.entries(response).map(([code, codeSchema]) => [
						code,
						convertSchema(codeSchema, 'input')
					])
				);
			}

			if (options.addCommonResponses) {
				responses = {
					...Object.fromEntries(
						Object.entries(options.addCommonResponses(route)).map(
							([code, codeSchema]) => [
								code.toString(),
								convertSchema(codeSchema, 'input')
							]
						)
					),
					...responses
				};
			}

			if (Object.keys(responses).length > 0) {
				jsonSchema.response = responses;
			}

			return { schema: jsonSchema, url };
		}
	});
};

export default fp(ValibotSwaggerPlugin);

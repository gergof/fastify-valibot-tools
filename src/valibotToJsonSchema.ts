import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

const valibotToJsonSchema = (
	schema: v.GenericSchema,
	typeMode: 'input' | 'output'
) => {
	return toJsonSchema(schema, {
		target: 'openapi-3.0',
		typeMode,
		errorMode: 'ignore',
		overrideSchema: ({ valibotSchema, jsonSchema }) => {
			if (valibotSchema.type === 'loose_object') {
				return { ...jsonSchema, additionalProperties: true };
			}

			return undefined;
		}
	});
};

export default valibotToJsonSchema;

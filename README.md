# fastify-valibot-tools

Utilities for using [Valibot](https://valibot.dev/) schemas with Fastify validation, response serialization, and OpenAPI documentation.

## Features

- Validates request bodies, query strings, route parameters, and headers with Valibot.
- Returns transformed Valibot output from request validation.
- Infers Fastify request and reply types from route schemas.
- Serializes responses with `fast-json-stringify`.
- Converts Valibot schemas to OpenAPI 3.0 schemas.
- Generates OpenAPI documentation through `@fastify/swagger`.
- Supports Fastify content-type-specific body and response schemas.

## Installation

```sh
npm install fastify-valibot-tools fastify valibot
```

The package is ESM-only and requires Fastify 5.12.7 or newer within the Fastify 5 release line.

## Validation and serialization

Register `ValibotValidationPlugin` before declaring routes that use Valibot schemas:

```ts
import Fastify from 'fastify';
import { ValibotValidationPlugin } from 'fastify-valibot-tools';
import * as v from 'valibot';

const fastify = Fastify();

await fastify.register(ValibotValidationPlugin);

const CreateUserSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1)),
	age: v.pipe(v.number(), v.minValue(18))
});

const UserSchema = v.object({
	id: v.number(),
	name: v.string(),
	age: v.number()
});

fastify.post(
	'/users',
	{
		schema: {
			body: CreateUserSchema,
			response: {
				201: UserSchema
			}
		}
	},
	async (request, reply) => {
		const user = {
			id: 1,
			name: request.body.name,
			age: request.body.age
		};

		return reply.code(201).send(user);
	}
);

await fastify.listen({ port: 3000 });
```

The plugin augments Fastify's default type provider. Request values are inferred as `v.InferOutput<Schema>` because Valibot validation and transformations run before the handler. Reply values are inferred as `v.InferInput<Schema>` because response schemas are used for serialization and are not parsed by Valibot.

### Validation errors

Invalid requests receive Fastify's standard HTTP 400 validation response. The underlying Valibot issues are available on `ValibotValidationError.issues`:

```ts
import Fastify from 'fastify';
import ValibotValidationPlugin, {
	ValibotValidationError
} from 'fastify-valibot-tools/validation-plugin';

const fastify = Fastify();

await fastify.register(ValibotValidationPlugin);

fastify.setErrorHandler((error, request, reply) => {
	if (error instanceof ValibotValidationError) {
		return reply.code(400).send({
			message: error.message,
			issues: error.issues
		});
	}

	return reply.send(error);
});
```

### Loose objects

Additional properties from `v.looseObject()` response schemas are preserved during serialization:

```ts
const ResponseSchema = v.looseObject({
	id: v.number()
});

fastify.get(
	'/user',
	{
		schema: {
			response: {
				200: ResponseSchema
			}
		}
	},
	async () => ({ id: 1, displayName: 'John' })
);
```

## OpenAPI documentation

`ValibotSwaggerPlugin` registers `@fastify/swagger` in dynamic OpenAPI mode and converts route schemas automatically. Register it before declaring routes:

```ts
import Fastify from 'fastify';
import {
	ValibotSwaggerPlugin,
	ValibotValidationPlugin
} from 'fastify-valibot-tools';
import * as v from 'valibot';

const fastify = Fastify();

await fastify.register(ValibotValidationPlugin);
await fastify.register(ValibotSwaggerPlugin, {
	info: {
		title: 'Users API',
		version: '1.0.0'
	}
});

fastify.get(
	'/users/:id',
	{
		schema: {
			summary: 'Get a user',
			params: v.object({
				id: v.string()
			}),
			response: {
				200: v.object({
					id: v.string(),
					name: v.string()
				})
			}
		}
	},
	async request => ({
		id: request.params.id,
		name: 'John'
	})
);

await fastify.ready();

const openapiDocument = fastify.swagger();
```

The generated document uses OpenAPI 3.0.3. This plugin generates the document but does not expose Swagger UI.

### Common responses

Use `addCommonResponses` to add Valibot response schemas based on the Fastify route. The callback uses numeric HTTP status-code keys, which the plugin normalizes to strings for OpenAPI. Route-specific responses take precedence when they use the same status code.

```ts
await fastify.register(ValibotSwaggerPlugin, {
	info: {
		title: 'Users API',
		version: '1.0.0'
	},
	addCommonResponses: route => ({
		401: v.object({
			message: v.string()
		}),
		...(route.method === 'DELETE'
			? {
					404: v.object({
						message: v.string()
					})
				}
			: {})
	})
});
```

Common response schemas and Valibot schemas declared directly on routes are converted automatically.

### Content-type-specific schemas

Fastify content wrappers are supported for request bodies and responses. The nested `schema` values should be Valibot schemas:

```ts
fastify.post('/users', {
	schema: {
		body: {
			content: {
				'application/json': {
					schema: CreateUserSchema
				}
			}
		},
		response: {
			201: {
				description: 'Created user',
				content: {
					'application/json': {
						schema: UserSchema
					}
				}
			}
		}
	},
	handler: async () => ({
		id: 1,
		name: 'John',
		age: 30
	})
});
```

## Converting schemas directly

Use `valibotToJsonSchema` when an OpenAPI 3.0 schema is needed outside the plugins:

```ts
import { valibotToJsonSchema } from 'fastify-valibot-tools';
import * as v from 'valibot';

const schema = v.object({
	id: v.number(),
	name: v.string()
});

const inputSchema = valibotToJsonSchema(schema, 'input');
const outputSchema = valibotToJsonSchema(schema, 'output');
```

The second argument selects which side of a Valibot transformation pipeline is represented. Unsupported Valibot features are ignored during conversion, so review the generated schema when using custom or non-JSON-compatible schemas.

## Package exports

The following entry points are available:

```ts
import {
	ValibotSwaggerPlugin,
	ValibotValidationPlugin,
	valibotToJsonSchema
} from 'fastify-valibot-tools';

import valibotToJsonSchema from 'fastify-valibot-tools/to-json-schema';
import ValibotValidationPlugin from 'fastify-valibot-tools/validation-plugin';
import ValibotSwaggerPlugin from 'fastify-valibot-tools/swagger-plugin';
```

## License

MIT

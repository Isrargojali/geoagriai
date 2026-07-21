import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createFarmSchema, updateFarmSchema } from '@geoagri/shared';
import { BadRequestError } from '../../lib/errors.js';
import { farmDtoSchema, messageSchema } from '../../schemas/dto.js';
import * as farmService from './farm.service.js';
import { geometryFromGeoJsonUpload, geometryFromKmlUpload } from './geometry.service.js';

const farmIdParams = z.object({ farmId: z.string() });

export async function farmRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['farms'],
        summary: "List the current user's farms",
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(farmDtoSchema) },
      },
    },
    async (request) => farmService.listFarms(request.currentUser.id),
  );

  r.get(
    '/:farmId',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['farms'],
        summary: 'Get a single farm with boundary and latest analysis',
        security: [{ bearerAuth: [] }],
        params: farmIdParams,
        response: { 200: farmDtoSchema },
      },
    },
    async (request) => farmService.getFarm(request.currentUser.id, request.params.farmId),
  );

  r.post(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['farms'],
        summary: 'Create a farm from a drawn polygon',
        security: [{ bearerAuth: [] }],
        body: createFarmSchema,
        response: { 201: farmDtoSchema },
      },
    },
    async (request, reply) => {
      const farm = await farmService.createFarm(
        request.currentUser.id,
        request.body,
        'DRAWN',
        request.ip,
      );
      return reply.status(201).send(farm);
    },
  );

  r.post(
    '/upload',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['farms'],
        summary: 'Create a farm from an uploaded GeoJSON or KML file',
        description:
          'Multipart form upload. Fields: file (GeoJSON/KML), name (required), ' +
          'description, cropType, plantingDate (optional).',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        response: { 201: farmDtoSchema },
      },
    },
    async (request, reply) => {
      const parts = request.parts();
      let fileContent: string | null = null;
      let fileName = '';
      const fields: Record<string, string> = {};

      for await (const part of parts) {
        if (part.type === 'file') {
          fileName = part.filename ?? '';
          fileContent = (await part.toBuffer()).toString('utf-8');
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      if (!fileContent) throw new BadRequestError('No boundary file uploaded');
      if (!fields.name) throw new BadRequestError('Farm name is required');

      const lower = fileName.toLowerCase();
      const isKml = lower.endsWith('.kml');
      const isGeoJson =
        lower.endsWith('.geojson') || lower.endsWith('.json') || fileContent.trimStart().startsWith('{');
      if (!isKml && !isGeoJson) {
        throw new BadRequestError('Unsupported file type. Upload a .geojson, .json or .kml file.');
      }

      const geometry = isKml
        ? geometryFromKmlUpload(fileContent)
        : geometryFromGeoJsonUpload(fileContent);

      const input = createFarmSchema.parse({
        name: fields.name,
        description: fields.description || undefined,
        cropType: fields.cropType || undefined,
        plantingDate: fields.plantingDate || undefined,
        geometry,
      });

      const farm = await farmService.createFarm(
        request.currentUser.id,
        input,
        isKml ? 'KML' : 'GEOJSON',
        request.ip,
      );
      return reply.status(201).send(farm);
    },
  );

  r.patch(
    '/:farmId',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['farms'],
        summary: 'Update a farm (metadata and/or boundary)',
        security: [{ bearerAuth: [] }],
        params: farmIdParams,
        body: updateFarmSchema,
        response: { 200: farmDtoSchema },
      },
    },
    async (request) =>
      farmService.updateFarm(
        request.currentUser.id,
        request.params.farmId,
        request.body,
        request.ip,
      ),
  );

  r.delete(
    '/:farmId',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['farms'],
        summary: 'Delete a farm and all its analyses',
        security: [{ bearerAuth: [] }],
        params: farmIdParams,
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await farmService.deleteFarm(request.currentUser.id, request.params.farmId, request.ip);
      return { message: 'Farm deleted' };
    },
  );
}

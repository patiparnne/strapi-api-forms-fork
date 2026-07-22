/**
 *  controller
 */
import { factories } from '@strapi/strapi';
import { normalizeSubmissionData } from '../functions';
import { assertUploadFolderExists, getUploadConfig, validateUploads } from '../upload-validation';

export default factories.createCoreController('plugin::api-forms.submission', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = {
      ...ctx.query,
      populate: {
        files: true,
      },
    };

    const response = await super.find(ctx);
    const fileService = strapi.plugin('upload').service('file');

    response.data = await Promise.all(
      response.data.map(async (submission) => ({
        ...submission,
        files: await Promise.all(
          (submission.files || []).map((file) => fileService.signFileUrls(file))
        ),
      }))
    );

    return response;
  },

  async post(ctx) {
    let uploadedFiles: any[] = [];

    try {
      const { form, submission } = ctx.request.body;

      if (!form) {
        return ctx.badRequest('No data provided');
      }

      if (!submission) {
        return ctx.badRequest('Invalid submission data');
      }

      const strapiForm = await strapi
        .documents('plugin::api-forms.form')
        .findOne({ documentId: form });

      if (!strapiForm) {
        return ctx.badRequest('Form not found');
      }

      const uploadConfig = getUploadConfig(strapi);
      const { uploads, errors } = await validateUploads(
        strapiForm,
        ctx.request.files as Record<string, unknown> | undefined,
        uploadConfig
      );

      if (errors.length > 0) {
        return ctx.badRequest('Invalid uploaded files', { errors });
      }

      await assertUploadFolderExists(strapi, uploadConfig.folderId);

      const normalizedSubmission = normalizeSubmissionData(submission);
      const flattenedFiles = uploads.flatMap((upload) => upload.files);
      const fileInfo = uploads.flatMap((upload) =>
        upload.files.map((file) => ({
          name: file.originalFilename || undefined,
          caption: upload.field?.label || upload.fieldName,
          alternativeText: file.originalFilename || undefined,
          folder: uploadConfig.folderId,
        }))
      );

      for (const upload of uploads) {
        if (upload.field) {
          normalizedSubmission[upload.field.label] = upload.files.map(
            (file) => file.originalFilename || 'unnamed-file'
          );
        }
      }

      if (flattenedFiles.length > 0) {
        for (const [index, file] of flattenedFiles.entries()) {
          const createdFiles = await strapi
            .plugin('upload')
            .service('upload')
            .upload({
              data: { fileInfo: fileInfo[index] },
              files: file,
            });
          uploadedFiles.push(...createdFiles);
        }
      }

      return await strapi.documents('plugin::api-forms.submission').create({
        data: {
          form: {
            connect: form,
          },
          submission: normalizedSubmission,
          files: uploadedFiles.map((file) => file.id),
        },
        populate: ['form', 'files'],
      });
    } catch (error) {
      if (uploadedFiles.length > 0) {
        await Promise.allSettled(
          uploadedFiles.map((file) => strapi.plugin('upload').service('upload').remove(file))
        );
      }

      strapi.log.error('Submission error:', error);
      const message = error instanceof Error ? error.message : 'Unknown submission error';
      return ctx.internalServerError(message);
    }
  },

  async export(ctx) {
    const { id } = ctx.params;
    return {
      data: await strapi.plugin('api-forms').service('submission').export(id),
      filename: `export-${id}-${Math.random()}.csv`,
    };
  },
}));

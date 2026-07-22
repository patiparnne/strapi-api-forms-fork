import path from 'node:path';
import { readFile } from 'node:fs/promises';

type AllowedType = 'images' | 'files';

type MultipartFile = {
  filepath?: string;
  originalFilename?: string | null;
  mimetype?: string | null;
  size?: number;
};

type ApiFormField = {
  label: string;
  name: string;
  type: string;
  config?: {
    required?: boolean;
    validation?: {
      allowedTypes?: AllowedType;
    };
  };
};

type UploadConfig = {
  imageExtensions: string[];
  fileExtensions: string[];
  maxFilesPerField: number;
  maxFileSizeMb: number;
  folderId?: number;
};

export type UploadValidationError = {
  fieldName: string;
  code: 'required' | 'too_many' | 'too_large' | 'invalid_type' | 'unknown_field';
  message: string;
  fileName?: string;
};

export type PreparedUpload = {
  field: ApiFormField | null;
  fieldName: string;
  files: MultipartFile[];
};

const DEFAULT_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];
const DEFAULT_FILE_EXTENSIONS = ['pdf', 'csv', 'xls', 'xlsx', 'docx'];

const MIME_TYPES_BY_EXTENSION: Record<string, string[]> = {
  jpg: ['image/jpeg', 'image/jpg'],
  jpeg: ['image/jpeg', 'image/jpg'],
  png: ['image/png'],
  gif: ['image/gif'],
  pdf: ['application/pdf'],
  csv: ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
  xls: ['application/vnd.ms-excel', 'application/x-cfb'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
};

const GENERIC_MIME_TYPES = ['', 'application/octet-stream'];

const normalizeExtensions = (value: unknown, fallback: string[]) => {
  const values = Array.isArray(value) ? value : [];
  const normalized = values
    .map((extension) => String(extension).trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean);

  return normalized.length > 0 ? [...new Set(normalized)] : fallback;
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
};

export const getUploadConfig = (strapi: any): UploadConfig => {
  const pluginConfig = strapi.config.get('plugin::api-forms') || {};
  const upload = pluginConfig.upload || {};

  return {
    imageExtensions: normalizeExtensions(upload.imageExtensions, DEFAULT_IMAGE_EXTENSIONS),
    fileExtensions: normalizeExtensions(upload.fileExtensions, DEFAULT_FILE_EXTENSIONS),
    maxFilesPerField: Math.floor(toPositiveNumber(upload.maxFilesPerField, 5)),
    maxFileSizeMb: toPositiveNumber(upload.maxFileSizeMb, 10),
    folderId: upload.folderId ? Number(upload.folderId) : undefined,
  };
};

const toFiles = (value: unknown): MultipartFile[] => {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean) as MultipartFile[];
};

export const getFileFields = (form: any): ApiFormField[] => {
  const fields = new Map<string, ApiFormField>();

  for (const step of form?.steps || []) {
    const layouts = step?.layouts || {};
    for (const layout of [layouts.lg, layouts.md, layouts.sm]) {
      for (const item of layout || []) {
        const field = item?.field as ApiFormField | undefined;
        if (field?.type === 'file' && field.name && !fields.has(field.name)) {
          fields.set(field.name, field);
        }
      }
    }
  }

  return [...fields.values()];
};

const allowedExtensionsForField = (field: ApiFormField | null, config: UploadConfig) => {
  const allowedTypes = field?.config?.validation?.allowedTypes;
  if (allowedTypes === 'images') return config.imageExtensions;
  if (allowedTypes === 'files') return config.fileExtensions;
  return [...new Set([...config.imageExtensions, ...config.fileExtensions])];
};

const getFileName = (file: MultipartFile) => file.originalFilename || 'unnamed-file';

const getZipEntryNames = (buffer: Buffer) => {
  const endOfCentralDirectorySignature = 0x06054b50;
  const centralDirectoryEntrySignature = 0x02014b50;
  const minimumEndRecordSize = 22;
  const maximumCommentSize = 0xffff;
  const searchStart = Math.max(0, buffer.length - minimumEndRecordSize - maximumCommentSize);
  let endRecordOffset = -1;

  for (let offset = buffer.length - minimumEndRecordSize; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endOfCentralDirectorySignature) {
      endRecordOffset = offset;
      break;
    }
  }

  if (endRecordOffset < 0) return [];

  const centralDirectorySize = buffer.readUInt32LE(endRecordOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endRecordOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  const entryNames: string[] = [];
  let offset = centralDirectoryOffset;

  while (offset + 46 <= centralDirectoryEnd && offset + 46 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== centralDirectoryEntrySignature) return [];

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;

    if (fileNameEnd > buffer.length) return [];

    entryNames.push(buffer.subarray(fileNameStart, fileNameEnd).toString('utf8'));
    offset = fileNameEnd + extraFieldLength + commentLength;
  }

  return entryNames;
};

const hasExpectedOfficeArchiveEntries = async (filePath: string, extension: string) => {
  const entryNames = new Set(getZipEntryNames(await readFile(filePath)));
  const requiredDocumentEntry =
    extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';

  return entryNames.has('[Content_Types].xml') && entryNames.has(requiredDocumentEntry);
};

const validateFileType = async (file: MultipartFile, allowedExtensions: string[]) => {
  const fileName = getFileName(file);
  const extension = path.extname(fileName).slice(1).toLowerCase();

  if (!extension || !allowedExtensions.includes(extension)) return false;

  const acceptableMimeTypes = MIME_TYPES_BY_EXTENSION[extension] || [];
  const declaredMime = (file.mimetype || '').toLowerCase();
  if (
    !GENERIC_MIME_TYPES.includes(declaredMime) &&
    acceptableMimeTypes.length > 0 &&
    !acceptableMimeTypes.includes(declaredMime)
  ) {
    return false;
  }

  let detectedMime: string | undefined;
  if (file.filepath) {
    try {
      const { fileTypeFromFile } = await import('file-type');
      detectedMime = (await fileTypeFromFile(file.filepath))?.mime;
    } catch {
      return false;
    }
  }

  if (!detectedMime) return extension === 'csv';
  if (
    (extension === 'docx' || extension === 'xlsx') &&
    detectedMime.toLowerCase() === 'application/zip' &&
    file.filepath
  ) {
    return hasExpectedOfficeArchiveEntries(file.filepath, extension);
  }

  return acceptableMimeTypes.includes(detectedMime.toLowerCase());
};

export const validateUploads = async (
  form: any,
  requestFiles: Record<string, unknown> | undefined,
  config: UploadConfig
): Promise<{ uploads: PreparedUpload[]; errors: UploadValidationError[] }> => {
  const fields = getFileFields(form);
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));
  const uploads: PreparedUpload[] = [];
  const errors: UploadValidationError[] = [];
  const uploadedFieldNames = new Set<string>();

  for (const [fieldName, value] of Object.entries(requestFiles || {})) {
    const field = fieldsByName.get(fieldName) || null;
    const isLegacyField = fieldName === 'files';
    const files = toFiles(value);

    if (!field && !isLegacyField) {
      errors.push({
        fieldName,
        code: 'unknown_field',
        message: `Unknown upload field: ${fieldName}`,
      });
      continue;
    }

    if (field) uploadedFieldNames.add(field.name);

    if (files.length > config.maxFilesPerField) {
      errors.push({
        fieldName,
        code: 'too_many',
        message: `You can upload up to ${config.maxFilesPerField} files`,
      });
      continue;
    }

    const allowedExtensions = allowedExtensionsForField(field, config);
    for (const file of files) {
      const fileName = getFileName(file);
      if ((file.size || 0) > config.maxFileSizeMb * 1024 * 1024) {
        errors.push({
          fieldName,
          fileName,
          code: 'too_large',
          message: `${fileName} exceeds ${config.maxFileSizeMb} MB`,
        });
        continue;
      }

      if (!(await validateFileType(file, allowedExtensions))) {
        errors.push({
          fieldName,
          fileName,
          code: 'invalid_type',
          message: `${fileName} is not a supported file type`,
        });
      }
    }

    uploads.push({ field, fieldName, files });
  }

  for (const field of fields) {
    if (field.config?.required && !uploadedFieldNames.has(field.name)) {
      errors.push({
        fieldName: field.name,
        code: 'required',
        message: `${field.label} is required`,
      });
    }
  }

  return { uploads, errors };
};

export const assertUploadFolderExists = async (strapi: any, folderId?: number) => {
  if (!folderId) return;

  const folder = await strapi.db.query('plugin::upload.folder').findOne({
    where: { id: folderId },
  });

  if (!folder) {
    throw new Error(`Configured API Forms upload folder ${folderId} does not exist`);
  }
};

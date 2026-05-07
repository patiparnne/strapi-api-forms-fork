import React, { useState, useEffect, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Field,
  SingleSelect,
  SingleSelectOption,
  Flex,
  Typography,
  Box,
  Checkbox
} from '@strapi/design-system';
import { DesignSystemProvider } from '@strapi/design-system';
import { useFetchClient } from '@strapi/strapi/admin';

interface FormFieldSelectorInputProps {
  name: string;
  value?: {
    formId?: string;
    visibleFields?: string[];
  };
  onChange: (value: any) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string | boolean;
  description?: string;
  intlLabel: {
    id: string;
    defaultMessage: string;
  };
  label?: string;
  hint?: string;
  fieldSchema?: {
    displayName?: string;
    description?: string;
    name?: string;
  };
  metadatas?: {
    label?: string;
    description?: string;
    placeholder?: string;
    visible?: boolean;
    editable?: boolean;
  };
}

interface FormType {
  documentId: string;
  title: string;
  steps: Array<{
    id: number;
    layouts: {
      lg: Array<{
        i: string;
        field: {
          name: string;
          label: string;
          type: string;
          config?: {
            required?: boolean;
          };
        };
      }>;
    };
  }>;
}

interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

const FormFieldSelectorInput: React.FC<FormFieldSelectorInputProps> = ({
  name,
  value = {},
  onChange,
  required = false,
  disabled = false,
  error,
  description,
  intlLabel,
  label,
  hint,
  fieldSchema,
  metadatas,
}) => {
  const { formatMessage } = useIntl();
  const { get } = useFetchClient();

  const [forms, setForms] = useState<FormType[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>(value?.formId || '');
  const [visibleFields, setVisibleFields] = useState<string[]>(value?.visibleFields || []);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all forms
  useEffect(() => {
    const fetchForms = async () => {
      try {
        setLoading(true);
        const response = await get('/api-forms/forms', {
          params: {
            pagination: { page: 1, pageSize: 100 },
            fields: ['title'],
            sort: 'createdAt:desc',
          },
        });

        console.log('Forms response:', response);

        if (response.data?.data) {
          setForms(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching forms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchForms();
  }, []);

  // Fetch form fields when a form is selected
  useEffect(() => {
    const fetchFormFields = async () => {
      if (!selectedFormId) {
        setFormFields([]);
        return;
      }

      try {
        setLoading(true);
        const response = await get(`/api-forms/forms/${selectedFormId}`, {
          params: {
            populate: ['steps'],
          },
        });

        console.log('Form details response:', response);

        if (response.data?.data?.steps) {
          const form = response.data.data as FormType;
          const fields: FormField[] = [];

          // Extract all fields from all steps
          form.steps.forEach((step) => {
            step.layouts.lg.forEach((layout) => {
              const field = layout.field;
              fields.push({
                name: field.name,
                label: field.label || field.name,
                type: field.type,
                required: field.config?.required || false,
              });
            });
          });

          setFormFields(fields);

          // If this is a new selection (no existing visibleFields), default to all fields
          if (!value?.visibleFields || value?.formId !== selectedFormId) {
            const defaultVisibleFields = fields.map(field => field.name);
            setVisibleFields(defaultVisibleFields);

            // Automatically save the default visible fields
            const newValue = {
              formId: selectedFormId,
              visibleFields: defaultVisibleFields,
            };

            onChange({
              target: {
                name,
                value: newValue,
                type: 'json',
              },
            });
          }
        }
      } catch (error) {
        console.error('Error fetching form fields:', error);
        setFormFields([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFormFields();
  }, [selectedFormId]);

  // Handle form selection change
  const handleFormChange = (formId: string) => {
    setSelectedFormId(formId);
    // Note: visibleFields will be set automatically when form fields are loaded
  };

  // Handle checkbox toggle
  const handleFieldToggle = (fieldName: string) => {
    // Check if the field is required
    const field = formFields.find(f => f.name === fieldName);
    if (field?.required) {
      // Don't allow toggling required fields
      return;
    }

    const newVisibleFields = visibleFields.includes(fieldName)
      ? visibleFields.filter((f) => f !== fieldName)
      : [...visibleFields, fieldName];

    setVisibleFields(newVisibleFields);

    const newValue = {
      formId: selectedFormId,
      visibleFields: newVisibleFields,
    };

    onChange({
      target: {
        name,
        value: newValue,
        type: 'json',
      },
    });
  };

  // Helper function to get the proper field label
  const getFieldLabel = () => {
    if (label) return label;
    if (metadatas?.label) return metadatas.label;
    if (fieldSchema?.displayName) return fieldSchema.displayName;
    if (name) {
      return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (str) => str.toUpperCase());
    }
    return intlLabel?.defaultMessage || intlLabel?.id || 'Form Field Selector';
  };

  return (
    <Field.Root error={error} required={required} name={name}>
      <Field.Label>{getFieldLabel()}</Field.Label>

      {/* Form Selector */}
      <SingleSelect
        value={selectedFormId || undefined}
        onChange={(value: string | number) => {
          handleFormChange(value as string);
        }}
        onClear={() => {
          setSelectedFormId('');
          setVisibleFields([]);
          onChange({
            target: {
              name,
              value: { formId: '', visibleFields: [] },
              type: 'json',
            },
          });
        }}
        disabled={disabled || loading}
        placeholder={loading ? 'Loading forms...' : 'Select a form...'}
      >
        {!required && (
          <SingleSelectOption value="">
            <Typography textColor="neutral400">-</Typography>
          </SingleSelectOption>
        )}
        {forms.map((form) => (
          <SingleSelectOption key={form.documentId} value={form.documentId}>
            {form.title}
          </SingleSelectOption>
        ))}
      </SingleSelect>

      {description || hint || fieldSchema?.description || metadatas?.description}

      <Field.Error />

      {/* Field Visibility Checkboxes */}
      {selectedFormId && formFields.length > 0 && (
        <Box marginTop={4}>
          <Typography variant="sigma" textColor="neutral600" marginBottom={2}>
            Visible Fields
          </Typography>
          <Field.Hint>
            Select which fields to display in this document's form. All fields are selected by default.
          </Field.Hint>
          <Flex direction="column" gap={2}>
            {formFields.map((field) => (
              <Box
                key={field.name}
                padding={2}
                background="neutral0"
                borderRadius="4px"
                borderWidth="1px"
                borderStyle="solid"
                borderColor="neutral200"
                width="100%"
              >
                <Checkbox
                  name={field.name}
                  checked={visibleFields.includes(field.name)}
                  onCheckedChange={() => handleFieldToggle(field.name)}
                  disabled={disabled || field.required}
                >
                  <Flex direction="column" gap={1} width="100%" style={{ alignItems: 'flex-start' }}>
                    <Typography fontWeight="bold">
                      {field.label}
                    </Typography>
                    <Typography variant="pi" textColor="neutral600">
                      {field.name} • {field.type}
                      {field.required && (
                        <span style={{ color: '#d02b20', marginLeft: '4px' }}>
                          • Required field (must be visible)
                        </span>
                      )}
                    </Typography>
                  </Flex>
                </Checkbox>
              </Box>
            ))}
          </Flex>

          <Box marginTop={2} padding={2} background={visibleFields.length > 0 ? "success100" : "neutral150"} hasRadius>
            <Typography variant="pi" textColor={visibleFields.length > 0 ? "success700" : "neutral600"}>
              {visibleFields.length > 0 ? '✓' : '⚠'} {visibleFields.length} of {formFields.length} field{formFields.length !== 1 ? 's' : ''} will be displayed
              {formFields.some(f => f.required) && ` (${formFields.filter(f => f.required).length} required)`}
            </Typography>
          </Box>
        </Box>
      )}

      {selectedFormId && formFields.length === 0 && !loading && (
        <Box marginTop={4}>
          <Typography textColor="neutral600" fontStyle="italic">
            This form has no fields
          </Typography>
        </Box>
      )}
    </Field.Root>
  );
};

export default FormFieldSelectorInput;

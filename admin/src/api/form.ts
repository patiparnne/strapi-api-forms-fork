//@ts-nocheck
import fetchInstance from '../utils/fetch';
import { FormRequest, FormResponse, FormType, MessageType } from '../utils/types';
import { stringify } from 'qs';

const formRequests = {
  getSettings: async (token: string): Promise<any> => {
    const data = await fetchInstance(`forms/settings`, token, 'GET', null, null, true);

    return data.json();
  },

  getForms: async (token: string, queryFilter?: object): Promise<FormResponse> => {
    try {
      // First, try the admin route with authentication
      const data = await fetchInstance(
        `forms?${stringify({
          pagination: { page: queryFilter.page, pageSize: queryFilter.pageSize },
          fields: ['title', 'createdAt', 'active', 'dateFrom', 'dateTill'],
          sort: 'createdAt:desc',
          populate: ['submissions', 'notifications'],
        })}`,
        token,
        'GET',
        null,
        null,
        true
      );

      if (!data.ok) {
        // If admin route fails with 401, try content-api route as fallback
        if (data.status === 401) {
          console.warn('Admin authentication failed, trying content-api route as fallback');
          const fallbackData = await fetchInstance(
            `forms?${stringify({
              pagination: { page: queryFilter.page, pageSize: queryFilter.pageSize },
              fields: ['title', 'createdAt', 'active', 'dateFrom', 'dateTill'],
              sort: 'createdAt:desc',
              populate: ['submissions', 'notifications'],
            })}`,
            '', // No token for content-api
            'GET',
            null,
            null,
            false // Use content-api route
          );
          
          if (!fallbackData.ok) {
            const errorText = await fallbackData.text();
            throw new Error(`Content-API fallback failed: ${fallbackData.status} ${errorText}`);
          }
          
          return fallbackData.json();
        }

        const errorText = await data.text();
        console.error('API Error:', data.status, errorText);
        throw new Error(`API request failed: ${data.status} ${data.statusText}`);
      }

      return data.json();
    } catch (error) {
      console.error('getForms error:', error);
      throw error;
    }
  },

  getForm: async (token: string, id: string | number, queryFilter?: object): Promise<FormType> => {
    const data = await fetchInstance(
      `forms/${id}${queryFilter ? `?${queryFilter}` : ''}`,
      token,
      'GET',
      null,
      null,
      true
    );

    const form = await data.json();

    return form.data;
  },

  getMessage: async (id: string | number): Promise<MessageType> => {
    const data = await fetchInstance(`form/${id}/message`, 'GET', null, null, true);
    const message = await data.json();

    return message.data;
  },

  getFormSubmissions: async (id: string, queryFilter?: object): Promise<FormType> => {
    const data = await fetchInstance(
      `form/${id}/submissions${queryFilter ? `?${queryFilter}` : ''}`,
      'GET',
      null,
      null,
      true
    );
    const form = await data.json();

    return form.data;
  },

  generateForm: async (token: string, formData?: object): Promise<any> => {
    try {
      const data = await fetchInstance(`forms/generate`, token, 'POST', null, formData, true);

      return data.json();
    } catch (error) {
      throw new Error('Failed to generate form');
    }
  },
  
  submitForm: async (token: string, formData?: object): Promise<FormRequest> => {
    try {
      const data = await fetchInstance(`forms`, token, 'POST', null, formData, true);

      if (!data.ok) {
        const errorText = await data.text();
        console.error('Submit form API error:', data.status, errorText);
        throw new Error(`Failed to submit form: ${data.status} ${data.statusText}`);
      }

      const result = await data.json();
      console.log('Submit form API response:', result);
      return result;
    } catch (error) {
      console.error('Submit form error:', error);
      throw new Error('Failed to submit form');
    }
  },

  updateForm: async (token: string, documentId: string, formData?: object): Promise<FormType[]> => {
    const data = await fetchInstance(`forms/${documentId}`, token, 'PUT', null, formData, true);

    return data.json();
  },

  deleteForm: async (token: string, documentId: string): Promise<any> => {
    const data = await fetchInstance(`forms/${documentId}`, token, 'DELETE', null, null, true);

    return data.json();
  },
};

export default formRequests;

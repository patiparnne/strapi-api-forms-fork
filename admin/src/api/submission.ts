//@ts-nocheck
import fetchInstance from '../utils/fetch';
import { SubmissionResponse, SubmissionsResponse } from '../utils/types';
import { stringify } from 'qs';

const submissionRequests = {
  getSubmissions: async (
    token: string,
    queryFilter?: object,
    formDocumentId?: string
  ): Promise<SubmissionsResponse> => {
    const data = await fetchInstance(
      `submissions?${stringify(
        {
          sort: 'publishedAt:desc',
          pagination: { page: queryFilter?.page, pageSize: queryFilter?.pageSize },
          filters: formDocumentId
            ? {
                form: {
                  documentId: {
                    $eq: formDocumentId,
                  },
                },
              }
            : undefined,
        },
        { encodeValuesOnly: true }
      )}`,
      token,
      'GET',
      null,
      null,
      true
    );

    return data.json();
  },

  getSubmission: async (token: string, id: string): Promise<SubmissionResponse> => {
    const data = await fetchInstance(`submission/${id}`, token, 'GET', null, null, true);

    return data.json();
  },
};

export default submissionRequests;

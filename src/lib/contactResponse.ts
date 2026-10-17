export const isContactSubmissionSuccessful = (responseOk: boolean, data: unknown): boolean => {
  return responseOk && typeof data === 'object' && data !== null &&
    'success' in data && data.success === true;
};

export const extractError = (error) => {
    if (!error) return "Unknown error occurred";
    if (error.response?.data?.message) return error.response.data.message;
    if (error.message) return error.message;
    return JSON.stringify(error);
  };
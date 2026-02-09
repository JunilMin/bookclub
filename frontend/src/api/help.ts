import axiosInstance from './axiosInstance';

export const submitHelpMessage = async (email: string, contents: string): Promise<{ success: boolean; loggedIn: boolean }> => {
  const response = await axiosInstance.post('/help', { email, contents });
  return response.data;
};

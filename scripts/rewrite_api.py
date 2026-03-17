import re

filepath = '/Users/vikrant/Documents/lab-assignment-evaluation-system/src/Modules/LabManager/api.js'

new_content = """import axios from 'axios';

const api = axios.create({ baseURL: '/api/lab-manager' });

export const loginUser = async (email) => {
  const { data } = await api.post('/auth/login', { email });
  return data;
};

export const fetchAllModules = async () => {
  const { data } = await api.get('/modules');
  return data;
};

export const fetchModuleDetails = async (moduleId) => {
  const { data } = await api.get(`/modules/${moduleId}`);
  return data;
};

export const createModule = async (moduleData) => {
  const { data } = await api.post('/modules', moduleData);
  return data;
};

export const updateModule = async (moduleId, moduleData) => {
  const { data } = await api.put(`/modules/${moduleId}`, moduleData);
  return data;
};

export const deleteModule = async (moduleId) => {
  const { data } = await api.delete(`/modules/${moduleId}`);
  return data;
};

export const duplicateModule = async (moduleId) => {
  const { data } = await api.post(`/modules/${moduleId}/duplicate`);
  return data;
};

export const createGroup = async (moduleId, groupData) => {
  const { data } = await api.post(`/modules/${moduleId}/groups`, groupData);
  return data;
};

export const updateGroup = async (moduleId, groupId, groupData) => {
  const { data } = await api.put(`/modules/${moduleId}/groups/${groupId}`, groupData);
  return data;
};

export const deleteGroup = async (moduleId, groupId) => {
  const { data } = await api.delete(`/modules/${moduleId}/groups/${groupId}`);
  return data;
};

export const duplicateGroup = async (moduleId, groupId) => {
  const { data } = await api.post(`/modules/${moduleId}/groups/${groupId}/duplicate`);
  return data;
};

export const updateEvaluation = async (moduleId, groupId, evaluationUpdates) => {
  const { data } = await api.put(`/modules/${moduleId}/groups/${groupId}/evaluation`, evaluationUpdates);
  return data;
};

export const mergePairs = async (moduleId, poorPairId, highPairId) => {
  const { data } = await api.post(`/modules/${moduleId}/merge`, { poorPairId, highPairId });
  return data;
};

export default api;
"""

with open(filepath, 'w') as f:
    f.write(new_content)

print("api.js rewritten successfully")

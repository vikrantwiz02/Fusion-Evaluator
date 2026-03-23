import axios from 'axios';

// Use relative URLs so they work in both dev and production
const api = axios.create({
  baseURL: '/api/lab-manager',
  headers: {
    'Content-Type': 'application/json',
  }
});
let supportsSpecificationsEndpoint = true;

function shouldFallbackToLegacySpecsSave(error) {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.error || '').toLowerCase();

  if (status === 404) return true;
  if (status === 403 && message.includes('admin access required')) return true;

  return false;
}

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const rawUser = window.localStorage.getItem('lab-user');
  if (!rawUser) return config;

  try {
    const user = JSON.parse(rawUser);
    const token = user?.token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Ignore malformed local storage values.
  }

  return config;
});

// Handle expired / invalid token — dispatch event so GlobalRoutes can log out
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export const loginWithGoogle = async (credential) => {
  const { data } = await api.post('/auth/google', { credential });
  return data;
};

export const fetchAllModules = async (scope = 'lead') => {
  try {
    const { data } = await api.get('/modules', { params: { scope } });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch modules');
  }
};

export const fetchModuleDetails = async (moduleId) => {
  try {
    const { data } = await api.get(`/modules/${moduleId}`);
    // Ensure data is valid
    if (data && typeof data === 'object' && data.id && Array.isArray(data.groups)) {
      return data;
    }
    throw new Error('Invalid module data structure received');
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch module details');
  }
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

export const fetchModuleSpecifications = async (moduleId) => {
  if (supportsSpecificationsEndpoint) {
    try {
      const { data } = await api.get(`/modules/${moduleId}/specifications`);
      return {
        useCases: Array.isArray(data?.useCases) ? data.useCases : [],
        workflows: Array.isArray(data?.workflows) ? data.workflows : [],
        businessRules: Array.isArray(data?.businessRules) ? data.businessRules : [],
        layout: data?.layout && typeof data.layout === 'object' && !Array.isArray(data.layout) ? data.layout : {},
      };
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
      supportsSpecificationsEndpoint = false;
    }
  }

  const { data } = await api.get(`/modules/${moduleId}`);
  return {
    useCases: Array.isArray(data?.spec_use_cases) ? data.spec_use_cases : [],
    workflows: Array.isArray(data?.spec_workflows) ? data.spec_workflows : [],
    businessRules: Array.isArray(data?.spec_rules) ? data.spec_rules : [],
    layout: data?.spec_layout && typeof data.spec_layout === 'object' && !Array.isArray(data.spec_layout) ? data.spec_layout : {},
  };
};

export const saveModuleSpecifications = async (moduleId, payload, options = {}) => {
  const uploadConfig = typeof options?.onUploadProgress === 'function'
    ? { onUploadProgress: options.onUploadProgress }
    : undefined;

  if (supportsSpecificationsEndpoint) {
    try {
      const { data } = await api.put(`/modules/${moduleId}/specifications`, payload, uploadConfig);
      return {
        useCases: Array.isArray(data?.useCases) ? data.useCases : [],
        workflows: Array.isArray(data?.workflows) ? data.workflows : [],
        businessRules: Array.isArray(data?.businessRules) ? data.businessRules : [],
        layout: data?.layout && typeof data.layout === 'object' && !Array.isArray(data.layout) ? data.layout : {},
      };
    } catch (error) {
      if (!shouldFallbackToLegacySpecsSave(error)) {
        throw error;
      }
      supportsSpecificationsEndpoint = false;
    }
  }

  // Backward-compatible fallback for backend instances missing the dedicated endpoint.
  const { data } = await api.put(`/modules/${moduleId}`, {
    spec_use_cases: payload.useCases,
    spec_workflows: payload.workflows,
    spec_rules: payload.businessRules,
    spec_layout: payload.layout,
  }, uploadConfig);

  return {
    useCases: Array.isArray(data?.spec_use_cases) ? data.spec_use_cases : [],
    workflows: Array.isArray(data?.spec_workflows) ? data.spec_workflows : [],
    businessRules: Array.isArray(data?.spec_rules) ? data.spec_rules : [],
    layout: data?.spec_layout && typeof data.spec_layout === 'object' && !Array.isArray(data.spec_layout) ? data.spec_layout : {},
  };
};

export const fetchTeamsModuleSpecifications = async (moduleId) => {
  if (supportsSpecificationsEndpoint) {
    try {
      const { data } = await api.get(`/modules/${moduleId}/team-specifications`);
      return {
        useCases: Array.isArray(data?.useCases) ? data.useCases : [],
        workflows: Array.isArray(data?.workflows) ? data.workflows : [],
        businessRules: Array.isArray(data?.businessRules) ? data.businessRules : [],
        layout: data?.layout && typeof data.layout === 'object' && !Array.isArray(data.layout) ? data.layout : {},
      };
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  }

  const { data } = await api.get(`/modules/${moduleId}`);
  return {
    useCases: Array.isArray(data?.team_spec_use_cases) ? data.team_spec_use_cases : [],
    workflows: Array.isArray(data?.team_spec_workflows) ? data.team_spec_workflows : [],
    businessRules: Array.isArray(data?.team_spec_rules) ? data.team_spec_rules : [],
    layout: data?.team_spec_layout && typeof data.team_spec_layout === 'object' && !Array.isArray(data.team_spec_layout) ? data.team_spec_layout : {},
  };
};

export const saveTeamsModuleSpecifications = async (moduleId, payload, options = {}) => {
  const uploadConfig = typeof options?.onUploadProgress === 'function'
    ? { onUploadProgress: options.onUploadProgress }
    : undefined;

  if (supportsSpecificationsEndpoint) {
    try {
      const { data } = await api.put(`/modules/${moduleId}/team-specifications`, payload, uploadConfig);
      return {
        useCases: Array.isArray(data?.useCases) ? data.useCases : [],
        workflows: Array.isArray(data?.workflows) ? data.workflows : [],
        businessRules: Array.isArray(data?.businessRules) ? data.businessRules : [],
        layout: data?.layout && typeof data.layout === 'object' && !Array.isArray(data.layout) ? data.layout : {},
      };
    } catch (error) {
      if (!shouldFallbackToLegacySpecsSave(error)) {
        throw error;
      }
      // Keep this flag false for this tab session to avoid repeated 403/404 noise.
      supportsSpecificationsEndpoint = false;
    }
  }

  const { data } = await api.put(`/modules/${moduleId}`, {
    team_spec_use_cases: payload.useCases,
    team_spec_workflows: payload.workflows,
    team_spec_rules: payload.businessRules,
    team_spec_layout: payload.layout,
  }, uploadConfig);

  return {
    useCases: Array.isArray(data?.team_spec_use_cases) ? data.team_spec_use_cases : [],
    workflows: Array.isArray(data?.team_spec_workflows) ? data.team_spec_workflows : [],
    businessRules: Array.isArray(data?.team_spec_rules) ? data.team_spec_rules : [],
    layout: data?.team_spec_layout && typeof data.team_spec_layout === 'object' && !Array.isArray(data.team_spec_layout) ? data.team_spec_layout : {},
  };
};

export const uploadModuleSpecsZip = async (moduleId, moduleSpecsZip, options = {}) => {
  const chunkSize = Number(options?.chunkSize || 240000);
  const readerResult = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(moduleSpecsZip);
  });

  const dataUrl = String(readerResult || '');
  const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
  if (!base64Data) {
    throw new Error('Failed to prepare zip upload data');
  }

  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const totalChunks = Math.max(1, Math.ceil(base64Data.length / chunkSize));
  let lastResponse = null;
  const uploadedAt = new Date().toISOString();

  const moduleSpecsZipPayload = {
    name: moduleSpecsZip.name,
    type: moduleSpecsZip.type || 'application/zip',
    size: moduleSpecsZip.size || 0,
    uploadedAt,
    dataUrl,
  };

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * chunkSize;
    const end = start + chunkSize;
    const chunkData = base64Data.slice(start, end);

    let data;
    try {
      const res = await api.put(`/modules/${moduleId}/specifications/zip`, {
        uploadId,
        fileName: moduleSpecsZip.name,
        fileType: moduleSpecsZip.type || 'application/zip',
        fileSize: moduleSpecsZip.size || 0,
        uploadedAt,
        chunkIndex,
        totalChunks,
        chunkData,
      });
      data = res.data;
    } catch (error) {
      // Compatibility fallback: backend not yet deployed with /specifications/zip route.
      if (error?.response?.status === 404) {
        const current = await fetchModuleSpecifications(moduleId);
        const { data: legacy } = await api.put(`/modules/${moduleId}`, {
          spec_layout: {
            ...(current?.layout && typeof current.layout === 'object' && !Array.isArray(current.layout) ? current.layout : {}),
            moduleSpecsZip: moduleSpecsZipPayload,
          },
        }, typeof options?.onUploadProgress === 'function' ? { onUploadProgress: options.onUploadProgress } : undefined);

        return {
          layout: legacy?.spec_layout && typeof legacy.spec_layout === 'object' && !Array.isArray(legacy.spec_layout)
            ? legacy.spec_layout
            : {},
        };
      }
      throw error;
    }

    lastResponse = data;
    if (typeof options?.onUploadProgress === 'function') {
      options.onUploadProgress({ loaded: chunkIndex + 1, total: totalChunks });
    }
  }

  return {
    layout: lastResponse?.layout && typeof lastResponse.layout === 'object' && !Array.isArray(lastResponse.layout)
      ? lastResponse.layout
      : {},
  };
};

export const uploadTeamsModuleSpecsZip = async (moduleId, moduleSpecsZip, options = {}) => {
  const chunkSize = Number(options?.chunkSize || 240000);
  const readerResult = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(moduleSpecsZip);
  });

  const dataUrl = String(readerResult || '');
  const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
  if (!base64Data) {
    throw new Error('Failed to prepare zip upload data');
  }

  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const totalChunks = Math.max(1, Math.ceil(base64Data.length / chunkSize));
  let lastResponse = null;
  const uploadedAt = new Date().toISOString();

  const moduleSpecsZipPayload = {
    name: moduleSpecsZip.name,
    type: moduleSpecsZip.type || 'application/zip',
    size: moduleSpecsZip.size || 0,
    uploadedAt,
    dataUrl,
  };

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * chunkSize;
    const end = start + chunkSize;
    const chunkData = base64Data.slice(start, end);

    let data;
    try {
      const res = await api.put(`/modules/${moduleId}/team-specifications/zip`, {
        uploadId,
        fileName: moduleSpecsZip.name,
        fileType: moduleSpecsZip.type || 'application/zip',
        fileSize: moduleSpecsZip.size || 0,
        uploadedAt,
        chunkIndex,
        totalChunks,
        chunkData,
      });
      data = res.data;
    } catch (error) {
      // Compatibility fallback: backend not yet deployed with /team-specifications/zip route.
      if (error?.response?.status === 404) {
        const current = await fetchTeamsModuleSpecifications(moduleId);
        const { data: legacy } = await api.put(`/modules/${moduleId}`, {
          team_spec_layout: {
            ...(current?.layout && typeof current.layout === 'object' && !Array.isArray(current.layout) ? current.layout : {}),
            moduleSpecsZip: moduleSpecsZipPayload,
          },
        }, typeof options?.onUploadProgress === 'function' ? { onUploadProgress: options.onUploadProgress } : undefined);

        return {
          layout: legacy?.team_spec_layout && typeof legacy.team_spec_layout === 'object' && !Array.isArray(legacy.team_spec_layout)
            ? legacy.team_spec_layout
            : {},
        };
      }
      throw error;
    }

    lastResponse = data;
    if (typeof options?.onUploadProgress === 'function') {
      options.onUploadProgress({ loaded: chunkIndex + 1, total: totalChunks });
    }
  }

  return {
    layout: lastResponse?.layout && typeof lastResponse.layout === 'object' && !Array.isArray(lastResponse.layout)
      ? lastResponse.layout
      : {},
  };
};

// ── Division CRUD ──────────────────────────────────────────────────────────────

export const createDivision = async (moduleId, divisionData) => {
  const { data } = await api.post(`/modules/${moduleId}/divisions`, divisionData);
  return data;
};

export const updateDivision = async (moduleId, divisionId, divisionData) => {
  const { data } = await api.put(`/modules/${moduleId}/divisions/${divisionId}`, divisionData);
  return data;
};

export const deleteDivision = async (moduleId, divisionId) => {
  const { data } = await api.delete(`/modules/${moduleId}/divisions/${divisionId}`);
  return data;
};

// ── Bulk timer ─────────────────────────────────────────────────────────────────

/**
 * Set (or clear) the access timer for multiple modules at once.
 * @param {string[]} moduleIds
 * @param {string|null} accessStart  ISO 8601 datetime or null to remove restriction
 * @param {string|null} accessEnd    ISO 8601 datetime or null to remove restriction
 */
export const bulkUpdateTimer = async (moduleIds, accessStart, accessEnd, applyForLeads = true, applyForTeams = true) => {
  const { data } = await api.put('/modules/bulk-timer', {
    moduleIds,
    access_start: accessStart,
    access_end: accessEnd,
    applyForLeads,
    applyForTeams,
  });
  return data;
};

export default api;
